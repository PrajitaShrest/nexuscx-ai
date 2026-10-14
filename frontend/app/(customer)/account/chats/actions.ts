"use server";

import { revalidatePath } from "next/cache";
import { customerReply } from "@/lib/data/shop";
import { chatReplySchema, check, formObject, ratingSchema } from "@/lib/validation";

export type ReplyState = { error?: string; sent?: number };

export async function reply(_p: ReplyState, f: FormData): Promise<ReplyState> {
  const v = check(chatReplySchema, formObject(f));
  if ("error" in v) return { error: v.error };
  const caseId = v.data.case_id;
  const r = await customerReply(caseId, v.data.message);
  if (r.error) return { error: r.error };
  revalidatePath(`/account/chats/${caseId}`);
  return { sent: Date.now() };
}

export type RateState = { error?: string; done?: boolean };

export async function rate(_p: RateState, f: FormData): Promise<RateState> {
  const v = check(ratingSchema, formObject(f));
  if ("error" in v) return { error: v.error };
  const caseId = v.data.case_id;
  const { rateCase } = await import("@/lib/data/workspace");
  const r = await rateCase(caseId, v.data.rating, v.data.comment);
  if (r.error) return { error: r.error };
  revalidatePath(`/account/chats/${caseId}`);
  return { done: true };
}
