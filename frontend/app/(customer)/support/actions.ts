"use server";

import { revalidatePath } from "next/cache";
import { answerFeedback, submitEnquiry, type EnquiryResult } from "@/lib/data/cases";
import { check, enquirySchema } from "@/lib/validation";
import { aiChangeOrderOption, type ChangeResult } from "@/lib/data/shop";

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

// The Orders Agent: check the order (order number + delivery postcode), then change a size or colour
export async function changeOrderOption(orderNumber: string, postcode: string, item: string | null, value: string | null): Promise<ChangeResult> {
  const num = orderNumber.trim().toUpperCase();
  const post = postcode.trim();
  if (!/^NX-\d{3,8}$/.test(num)) return { status: "error", message: "Order numbers look like NX-1009. You can find yours in My orders." };
  if (!/^\d{4}$/.test(post)) return { status: "error", message: "Please enter the 4-digit postcode of the delivery address." };
  if (item && !/^[0-9a-f-]{36}$/i.test(item)) return { status: "error", message: "That item could not be found." };
  const { data, error } = await aiChangeOrderOption(num, post, item, value ? value.slice(0, 30) : null);
  if (error || !data) return { status: "error", message: error ?? "Something went wrong. Please try again." };
  if (data.status === "changed") { revalidatePath("/support"); revalidatePath("/account/orders"); }
  return data;
}
