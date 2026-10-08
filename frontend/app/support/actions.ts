"use server";

import { revalidatePath } from "next/cache";
import { submitEnquiry, type EnquiryResult } from "@/lib/data/cases";

export type EnquiryState = { error?: string; result?: EnquiryResult; message?: string };

export async function sendEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  const message = String(formData.get("message") ?? "").trim();
  // Validate on the server first (the database checks again)
  if (message.length < 5) return { error: "Please describe your issue in at least 5 characters.", message };
  if (message.length > 2000) return { error: "Please keep your message under 2000 characters.", message };

  const { data, error } = await submitEnquiry(message);
  if (error || !data) return { error: error ?? "Something went wrong. Please try again.", message };
  revalidatePath("/support");
  return { result: data, message };
}
