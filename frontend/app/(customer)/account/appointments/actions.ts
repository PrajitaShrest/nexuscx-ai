"use server";

import { revalidatePath } from "next/cache";
import { bookAppointment, cancelMyAppointment, requestCallback } from "@/lib/data/appointments";

export type TalkState = { error?: string; done?: "callback" | "booking"; urgent?: boolean; when?: string };

const okId = (s: string) => s === "" || /^[0-9a-f-]{36}$/i.test(s);

// "Call me now / call me back today"
export async function askCallback(_p: TalkState, f: FormData): Promise<TalkState> {
  const caseId = String(f.get("case_id") ?? "");
  const phone = String(f.get("phone") ?? "").slice(0, 30);
  const note = String(f.get("note") ?? "").slice(0, 500);
  if (!okId(caseId)) return { error: "Something went wrong. Please refresh the page." };
  const r = await requestCallback(caseId || null, phone, note);
  if (r.error) return { error: r.error };
  revalidatePath("/account/appointments");
  if (caseId) revalidatePath(`/account/chats/${caseId}`);
  return { done: "callback", urgent: (r.data as { urgency?: string } | undefined)?.urgency === "urgent" };
}

// "Book a time"
export async function bookTime(_p: TalkState, f: FormData): Promise<TalkState> {
  const caseId = String(f.get("case_id") ?? "");
  const slot = String(f.get("slot") ?? "");
  if (!okId(caseId)) return { error: "Something went wrong. Please refresh the page." };
  if (!slot) return { error: "Please pick a time." };
  const r = await bookAppointment({
    team: String(f.get("team") ?? ""), slot, mode: String(f.get("mode") ?? ""),
    phone: String(f.get("phone") ?? "").slice(0, 30), note: String(f.get("note") ?? "").slice(0, 500), caseId: caseId || null,
  });
  if (r.error) return { error: r.error };
  revalidatePath("/account/appointments");
  if (caseId) revalidatePath(`/account/chats/${caseId}`);
  return { done: "booking", when: slot };
}

export async function cancelAppointment(id: string): Promise<{ error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "This appointment could not be found." };
  const r = await cancelMyAppointment(id);
  if (r.error) return { error: r.error };
  revalidatePath("/account/appointments");
  return {};
}
