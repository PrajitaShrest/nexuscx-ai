"use server";

import { revalidatePath } from "next/cache";
import { check, formObject, noteSchema, staffReplySchema } from "@/lib/validation";
import { staffAddNote, staffReply, staffSetStatus, staffTakeCase, staffUpdateReturn } from "@/lib/data/workspace";

export type CaseActionState = { error?: string; ok?: string; at?: number };

const done = (id: string, ok: string): CaseActionState => {
  revalidatePath(`/cases/${id}`);
  revalidatePath("/cases");
  revalidatePath("/conversations");
  return { ok, at: Date.now() };
};

export async function take(_p: CaseActionState, f: FormData): Promise<CaseActionState> {
  const id = String(f.get("case_id"));
  const r = await staffTakeCase(id);
  return r.error ? { error: r.error } : done(id, "You have taken this case. The customer has been told.");
}

export async function reply(_p: CaseActionState, f: FormData): Promise<CaseActionState> {
  const v = check(staffReplySchema, formObject(f));
  if ("error" in v) return { error: v.error };
  const { case_id: id, message, then } = v.data;
  const r = await staffReply(id, message);
  if (r.error) return { error: r.error };
  if (then) await staffSetStatus(id, then, "");
  return done(id, "Sent to the customer.");
}

export async function setStatus(_p: CaseActionState, f: FormData): Promise<CaseActionState> {
  const id = String(f.get("case_id"));
  const status = String(f.get("status"));
  const r = await staffSetStatus(id, status, String(f.get("note") ?? ""));
  const label: Record<string, string> = { waiting: "Waiting for the customer.", resolved: "Case resolved.", closed: "Case closed.", human_handling: "Case reopened." };
  return r.error ? { error: r.error } : done(id, label[status] ?? "Updated.");
}

export async function addNote(_p: CaseActionState, f: FormData): Promise<CaseActionState> {
  const v = check(noteSchema, formObject(f));
  if ("error" in v) return { error: v.error };
  const id = v.data.case_id;
  const r = await staffAddNote(id, v.data.note);
  return r.error ? { error: r.error } : done(id, "Note saved.");
}

export async function updateReturn(_p: CaseActionState, f: FormData): Promise<CaseActionState> {
  const id = String(f.get("case_id"));
  const r = await staffUpdateReturn(String(f.get("return_id")), String(f.get("status")), String(f.get("note") ?? ""));
  if (r.error) return { error: r.error };
  revalidatePath("/returns");
  return done(id, "Return updated. The customer has been told.");
}
