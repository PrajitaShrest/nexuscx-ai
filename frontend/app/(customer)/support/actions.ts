"use server";

import { revalidatePath } from "next/cache";
import { answerFeedback, submitEnquiry, type EnquiryResult } from "@/lib/data/cases";
import { check, enquirySchema } from "@/lib/validation";

export type EnquiryState = { error?: string; result?: EnquiryResult; message?: string };

export async function sendEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  const message = String(formData.get("message") ?? "").trim();
  // Validate on the server first with the shared rules (the database checks again)
  const v = check(enquirySchema, { message });
  if ("error" in v) return { error: v.error, message };

  const { data, error } = await submitEnquiry(message, formData.get("clarified") === "1");
  if (error || !data) return { error: error ?? "Something went wrong. Please try again.", message };
  revalidatePath("/support");
  return { result: data, message };
}

// Thumbs up / thumbs down on an AI answer
export async function sendFeedback(caseId: string, helpful: boolean): Promise<{ status?: string; reply?: string; error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(caseId)) return { error: "This chat could not be found." };
  const { data, error } = await answerFeedback(caseId, helpful);
  if (error || !data) return { error: error ?? "Something went wrong. Please try again." };
  revalidatePath("/support");
  return { status: data.status, reply: data.reply };
}
