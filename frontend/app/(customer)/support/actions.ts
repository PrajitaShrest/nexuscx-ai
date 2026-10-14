"use server";

import { revalidatePath } from "next/cache";
import { submitEnquiry, type EnquiryResult } from "@/lib/data/cases";
import { check, enquirySchema } from "@/lib/validation";

export type EnquiryState = { error?: string; result?: EnquiryResult; message?: string };

export async function sendEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  const message = String(formData.get("message") ?? "").trim();
  // Validate on the server first with the shared rules (the database checks again)
  const v = check(enquirySchema, { message });
  if ("error" in v) return { error: v.error, message };

  const { data, error } = await submitEnquiry(message);
  if (error || !data) return { error: error ?? "Something went wrong. Please try again.", message };
  revalidatePath("/support");
  return { result: data, message };
}
