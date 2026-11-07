"use server";

import { revalidatePath } from "next/cache";
import { staffUpdateAppointment } from "@/lib/data/appointments";

export async function updateBooking(id: string, action: string, note: string): Promise<{ error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["take", "done", "missed", "cancel"].includes(action)) return { error: "Something went wrong. Please refresh." };
  const r = await staffUpdateAppointment(id, action, note.slice(0, 300));
  if (r.error) return { error: r.error };
  revalidatePath("/bookings");
  return {};
}
