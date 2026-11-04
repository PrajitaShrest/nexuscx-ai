"use server";

import { revalidatePath } from "next/cache";
import { submitRequest, updateMyRequest } from "@/lib/data/requests";
import type { Values } from "@/lib/forms";

export type SendResult = { ok?: boolean; error?: string; request_id?: string; request_number?: string; team?: string; sla_hours?: number };

const okKey = (k: string) => /^[a-z_]{2,40}$/.test(k);
const okPhoto = (p: string | null) => p === null || /^[0-9a-f-]{36}\/[A-Za-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(p);
const okValues = (v: Values) => Object.keys(v).length <= 30 && Object.entries(v).every(([k, x]) => okKey(k) && (typeof x === "boolean" || (typeof x === "string" && x.length <= 500)));

// Send a form. The database checks every field again (and the photo is the person's own upload).
export async function sendRequest(type: string, values: Values, photo: string | null): Promise<SendResult> {
  if (!okKey(type) || !okValues(values) || !okPhoto(photo)) return { error: "Something in the form could not be read. Please check it and try again." };
  const { data, error } = await submitRequest(type, values, photo);
  if (error || !data) return { error: error ?? "Something went wrong. Please try again." };
  revalidatePath("/account/requests");
  return { ok: true, ...data };
}

// Send the changes staff asked for
export async function fixRequest(id: string, values: Values, photo: string | null): Promise<SendResult> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !okValues(values) || !okPhoto(photo)) return { error: "Something in the form could not be read. Please try again." };
  const { error } = await updateMyRequest(id, "resubmit", values, photo);
  if (error) return { error };
  revalidatePath(`/account/requests/${id}`);
  revalidatePath("/account/requests");
  return { ok: true, request_id: id };
}

export async function cancelRequest(id: string): Promise<{ error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "This request could not be found." };
  const { error } = await updateMyRequest(id, "cancel", null, null);
  if (error) return { error };
  revalidatePath(`/account/requests/${id}`);
  revalidatePath("/account/requests");
  return {};
}
