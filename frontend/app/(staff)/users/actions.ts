"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  adminDeleteUser, adminSetPermission, adminSetRoles, adminSetStatus, adminSetTempPassword,
  adminUnlock, adminUpdateUser, getOverview, sendResetLink,
} from "@/lib/data/admin";

export type AdminState = { error?: string; ok?: string; secret?: string };

const refresh = (id?: string) => {
  revalidatePath("/users");
  if (id) revalidatePath(`/users/${id}`);
};

export async function saveDetails(_p: AdminState, f: FormData): Promise<AdminState> {
  const id = String(f.get("user_id"));
  const team = String(f.get("team_id") ?? "");
  const r = await adminUpdateUser(id, String(f.get("name") ?? ""), team || null);
  if (r.error) return { error: r.error };
  refresh(id);
  return { ok: "Details saved." };
}

export async function saveRoles(_p: AdminState, f: FormData): Promise<AdminState> {
  const id = String(f.get("user_id"));
  const primary = String(f.get("primary") ?? "");
  const extra = f.getAll("extra").map(String).filter((r) => r !== primary);
  const r = await adminSetRoles(id, primary, extra);
  if (r.error) return { error: r.error };
  refresh(id);
  return { ok: "Roles saved. They apply the next time this person opens a page." };
}

export async function setStatus(_p: AdminState, f: FormData): Promise<AdminState> {
  const id = String(f.get("user_id"));
  const status = String(f.get("status")) === "suspended" ? "suspended" : "active";
  const r = await adminSetStatus(id, status);
  if (r.error) return { error: r.error };
  refresh(id);
  return { ok: status === "suspended" ? "Account suspended. They are signed out on their next click." : "Account reactivated." };
}

export async function unlock(_p: AdminState, f: FormData): Promise<AdminState> {
  const id = String(f.get("user_id"));
  const r = await adminUnlock(id);
  if (r.error) return { error: r.error };
  refresh(id);
  return { ok: "Account unlocked. They can sign in again now." };
}

export async function emailReset(_p: AdminState, f: FormData): Promise<AdminState> {
  const id = String(f.get("user_id"));
  const { data, error } = await getOverview(id);
  if (error || !data) return { error: error ?? "That person no longer exists." };
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const r = await sendResetLink(data.email, origin);
  if (r.error) return { error: r.error };
  return { ok: `Reset link sent to ${data.email}.` };
}

export async function tempPassword(_p: AdminState, f: FormData): Promise<AdminState> {
  const id = String(f.get("user_id"));
  const password = String(f.get("password") ?? "");
  const r = await adminSetTempPassword(id, password);
  if (r.error) return { error: r.error };
  refresh(id);
  return { ok: "Temporary password set. Give it to the person privately; they must change it when they sign in.", secret: password };
}

export async function deleteUser(_p: AdminState, f: FormData): Promise<AdminState> {
  const id = String(f.get("user_id"));
  const expected = String(f.get("expected") ?? "");
  if (String(f.get("confirm") ?? "").trim() !== expected) return { error: `Type ${expected} to confirm.` };
  const r = await adminDeleteUser(id);
  if (r.error) return { error: r.error };
  revalidatePath("/users");
  redirect(`/users?deleted=${r.data === "anonymised" ? "anonymised" : "removed"}`);
}

export async function togglePermission(role: string, permission: string, granted: boolean): Promise<{ error?: string }> {
  const r = await adminSetPermission(role, permission, granted);
  if (r.error) return { error: r.error };
  revalidatePath("/", "layout");
  return {};
}
