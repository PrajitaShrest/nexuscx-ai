"use server";

import { revalidatePath } from "next/cache";
import { customerReply } from "@/lib/data/shop";

export type ReplyState = { error?: string; sent?: number };

export async function reply(_p: ReplyState, f: FormData): Promise<ReplyState> {
  const caseId = String(f.get("case_id") ?? "");
  const message = String(f.get("message") ?? "").trim();
  if (message.length < 2) return { error: "Please write a message first." };
  const r = await customerReply(caseId, message);
  if (r.error) return { error: r.error };
  revalidatePath(`/account/chats/${caseId}`);
  return { sent: Date.now() };
}

export type RateState = { error?: string; done?: boolean };

export async function rate(_p: RateState, f: FormData): Promise<RateState> {
  const caseId = String(f.get("case_id") ?? "");
  const rating = Number(f.get("rating"));
  const { rateCase } = await import("@/lib/data/workspace");
  const r = await rateCase(caseId, rating, String(f.get("comment") ?? ""));
  if (r.error) return { error: r.error };
  revalidatePath(`/account/chats/${caseId}`);
  return { done: true };
}
