import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "./errors";

// "Talk to a person": call-backs and booked appointments (migration 031).
// Row Level Security: a person reads only their own; staff read their organisation's.
// Rule: wellbeing and product-safety chats never have to book. They get an urgent call-back.

export type Appointment = {
  appointment_id: string; case_id: string | null; kind: "callback" | "booking"; urgency: "urgent" | "today" | "normal";
  team: string; mode: string; slot_at: string | null; phone: string | null; note: string | null;
  status: string; handled_note: string | null; created_at: string; done_at: string | null;
};
export type StaffAppointment = Appointment & {
  customer: { student_number: string | null; user: { name: string; email: string } | null } | null;
  handler: { name: string } | null;
  cases: { case_number: string } | null;
};
export type BookingOptions = { teams: string[]; slots: string[]; taken: Record<string, string[]>; phone: string | null };

async function rpc(fn: string, args: Record<string, unknown>, context: string): Promise<{ data?: unknown; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.code === "22023" ? error.message : friendlyError(error, context) };
  return { data };
}

const COLS = "appointment_id, case_id, kind, urgency, team, mode, slot_at, phone, note, status, handled_note, created_at, done_at";

export async function getBookingOptions(): Promise<BookingOptions | null> {
  const r = await rpc("booking_options", {}, "loading the booking times");
  return (r.data as BookingOptions | undefined) ?? null;
}
export const requestCallback = (caseId: string | null, phone: string, note: string) =>
  rpc("request_callback", { p_case: caseId, p_phone: phone, p_note: note }, "asking for a call back");
export const bookAppointment = (a: { team: string; slot: string; mode: string; phone: string; note: string; caseId: string | null }) =>
  rpc("book_appointment", { p_team: a.team, p_slot: a.slot, p_mode: a.mode, p_phone: a.phone, p_note: a.note, p_case: a.caseId }, "booking a time");
export const cancelMyAppointment = (id: string) => rpc("cancel_my_appointment", { p_id: id }, "cancelling the appointment");
export const staffUpdateAppointment = (id: string, action: string, note: string) =>
  rpc("staff_update_appointment", { p_id: id, p_action: action, p_note: note }, "updating the appointment");

export async function listMyAppointments(): Promise<Appointment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments").select(COLS).order("created_at", { ascending: false }).limit(50);
  if (error) console.error("[listMyAppointments]", error.message);
  return (data ?? []) as Appointment[];
}

export async function listStaffAppointments(): Promise<StaffAppointment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments")
    .select(`${COLS}, customer:customers(student_number, user:users(name, email)), handler:users!appointments_handled_by_fkey(name), cases(case_number)`)
    .order("created_at", { ascending: false }).limit(300);
  if (error) console.error("[listStaffAppointments]", error.message);
  return (data ?? []) as unknown as StaffAppointment[];
}

// "Mon 9 Nov, 10:30 am" in Sydney time
export const slotText = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });
