import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "./errors";
import type { Prefill, RequestType, Values } from "@/lib/forms";

// Forms and service requests (migration 026).
// Row Level Security: a person reads only their own requests; staff read their organisation's.
// Every change goes through a database function that checks the form again.

export type RequestEvent = { event_id: string; status: string; note: string | null; actor_name: string | null; actor_type: string; created_at: string };
export type ServiceRequest = {
  request_id: string; request_number: string; type_key: string; status: string; details: Values;
  photo_path: string | null; staff_note: string | null; outcome: Record<string, string | boolean>;
  due_at: string | null; created_at: string; updated_at: string; ready_at: string | null; completed_at: string | null;
  order_id: string | null;
  request_types: { title: string; team_name: string; icon: string; sla_hours: number; fee_note: string | null } | null;
};
export type StaffRequest = ServiceRequest & {
  customer: { student_number: string | null; user: { name: string; email: string } | null } | null;
  assignee: { name: string } | null;
};
export type RequestDetail = StaffRequest & { service_request_events: RequestEvent[] };
export type RequestStats = { total: number; open: number; overdue: number; to_collect: number; finished: number; first_time_right: number; median_hours: number | null };

async function rpc(fn: string, args: Record<string, unknown>, context: string): Promise<{ data?: unknown; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.code === "22023" ? error.message : friendlyError(error, context) };
  return { data };
}

const COLS = "request_id, request_number, type_key, status, details, photo_path, staff_note, outcome, due_at, created_at, updated_at, ready_at, completed_at, order_id, request_types(title, team_name, icon, sla_hours, fee_note)";
const STAFF_COLS = `${COLS}, customer:customers(student_number, user:users(name, email)), assignee:users!service_requests_assigned_to_fkey(name)`;

// The forms this person can fill in, and their profile details to start each form with
export async function getRequestForms(): Promise<{ types: RequestType[]; prefill: Prefill }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_request_forms");
  if (error) { console.error("[getRequestForms]", error.message); return { types: [], prefill: {} }; }
  return data as { types: RequestType[]; prefill: Prefill };
}

export async function listMyRequests(): Promise<ServiceRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("service_requests").select(COLS).order("created_at", { ascending: false });
  if (error) console.error("[listMyRequests]", error.message);
  return (data ?? []) as unknown as ServiceRequest[];
}

export async function getRequest(id: string): Promise<RequestDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("service_requests")
    .select(`${STAFF_COLS}, service_request_events(event_id, status, note, actor_name, actor_type, created_at)`)
    .eq("request_id", id).maybeSingle();
  if (error) console.error("[getRequest]", error.message);
  if (!data) return null;
  const r = data as unknown as RequestDetail;
  r.service_request_events.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return r;
}

export async function listRequestQueue(): Promise<{ data: StaffRequest[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("service_requests").select(STAFF_COLS).order("created_at", { ascending: false }).limit(300);
  if (error) return { data: [], error: friendlyError(error, "listRequestQueue") };
  return { data: (data ?? []) as unknown as StaffRequest[] };
}

export async function requestStats(days = 30): Promise<RequestStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("service_request_stats", { p_days: days });
  if (error) { console.error("[requestStats]", error.message); return null; }
  return data as RequestStats;
}

// A short-lived private link to a request photo or document (only the owner and staff can make one).
// Credit applications keep the transcript in "request-documents"; other forms keep photos in "request-photos".
export async function signRequestPhoto(path: string | null, type = ""): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(type === "credit_transfer" ? "request-documents" : "request-photos").createSignedUrl(path, 3600);
  if (error) { console.error("[signRequestPhoto]", error.message); return null; }
  return data?.signedUrl ?? null;
}

export const submitRequest = (type: string, details: Values, photo: string | null) =>
  rpc("submit_service_request", { p_type: type, p_details: details, p_photo: photo }, "submitRequest") as Promise<{ data?: { request_id: string; request_number: string; team: string; sla_hours: number }; error?: string }>;
export const updateMyRequest = (id: string, action: "resubmit" | "cancel", details: Values | null, photo: string | null) =>
  rpc("update_my_service_request", { p_id: id, p_action: action, p_details: details, p_photo: photo }, "updateMyRequest");
export const staffUpdateRequest = (id: string, action: string, note: string | null) =>
  rpc("staff_update_service_request", { p_id: id, p_action: action, p_note: note }, "staffUpdateRequest");

// ---------- credit for previous study (migration 028) ----------
export type PriorUnit = { name: string; code: string; grade: string; year: string };
export type CreditUnit = { name: string; code: string; grade: string; year: number | null; decision: "granted" | "review" | "none"; reason: string; nb_code: string | null; nb_name: string | null };
export type CreditResult = { course: string; units: CreditUnit[]; granted_points: number; granted_units: number; review_units: number; total_points: number; cap_points: number };

export const checkCredit = (course: string, institution: string, units: PriorUnit[]) =>
  rpc("check_credit", { p_course: course, p_institution: institution, p_units: units }, "checkCredit") as Promise<{ data?: CreditResult; error?: string }>;
export const applyForCredit = (a: { course: string; intake: string; load: string; institution: string; qualification: string; units: PriorUnit[]; document: string | null }) =>
  rpc("apply_for_credit", { p_course: a.course, p_intake: a.intake, p_load: a.load, p_institution: a.institution, p_qualification: a.qualification, p_units: a.units, p_document: a.document },
    "applyForCredit") as Promise<{ data?: { request_id: string; request_number: string; status: string }; error?: string }>;
