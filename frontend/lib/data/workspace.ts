import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "./errors";

// Staff case workspace, returns and notifications.
// Reads are filtered by Row Level Security; every change is a database function
// that checks the caller's permission (resolve_cases for staff actions).

export type CaseMessage = { message_id: string; sender_type: string; sender_id: string | null; content: string; message_type: string; sent_at: string; sender_name?: string };
export type ReturnItem = { return_item_id: string; product_name: string; quantity: number; exchange_for: string | null };
export type ReturnRequest = {
  return_id: string; return_number: string; order_id: string; case_id: string | null; kind: string; reason: string;
  details: string | null; status: string; refund_cents: number; staff_note: string | null; created_at: string; updated_at: string;
  return_items: ReturnItem[]; photos: string[] | null;
};
export type CaseDetail = {
  case_id: string; case_number: string; subject: string | null; status: string; priority: string; intent: string | null;
  sentiment: string | null; urgency: string | null; risk: string | null; confidence: number | null;
  created_at: string; updated_at: string; sla_due_at: string | null; closed_at: string | null; first_response_at: string | null;
  customer: { customer_id: string; tier: string; phone: string | null; user: { name: string; email: string; username: string } | null } | null;
  order: { order_id: string; order_number: string; status: string; total_cents: number; created_at: string; tracking_number: string | null;
    order_items: { order_item_id: string; product_name: string; quantity: number; line_total_cents: number }[] } | null;
  messages: CaseMessage[];
  notes: { note_id: string; content: string; created_at: string; author: { name: string } | null }[];
  assignments: { status: string; assigned_at: string; user: { user_id: string; name: string } | null }[];
  escalations: { reason: string; status: string; created_at: string; escalated_from: string }[];
  returns: ReturnRequest[];
  agent: { name: string } | null;
  other_cases: { case_id: string; case_number: string; subject: string | null; status: string; created_at: string }[];
  order_count: number;
  conversation_ids: string[];
};

async function rpc(fn: string, args: Record<string, unknown>, context: string): Promise<{ data?: unknown; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.code === "22023" ? error.message : friendlyError(error, context) };
  return { data };
}

const RETURN_COLS = "return_id, return_number, order_id, case_id, kind, reason, details, status, refund_cents, staff_note, created_at, updated_at, photos, return_items(return_item_id, product_name, quantity, exchange_for)";

export async function getCaseDetail(id: string): Promise<CaseDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("cases").select(`
      case_id, case_number, subject, status, priority, intent, sentiment, urgency, risk, confidence,
      created_at, updated_at, sla_due_at, closed_at, first_response_at,
      customer:customers(customer_id, tier, phone, user:users(name, email, username)),
      order:orders(order_id, order_number, status, total_cents, created_at, tracking_number, order_items(order_item_id, product_name, quantity, line_total_cents)),
      conversations(conversation_id, messages(message_id, sender_type, sender_id, content, message_type, sent_at)),
      notes:case_notes(note_id, content, created_at, author:users(name)),
      assignments:case_assignments(status, assigned_at, user:users(user_id, name)),
      escalations(reason, status, created_at, escalated_from),
      returns:return_requests(${RETURN_COLS}),
      agent:ai_agents(name)`)
    .eq("case_id", id).maybeSingle();
  if (error) console.error("[getCaseDetail]", error.message);
  if (!data) return null;
  const raw = data as unknown as Omit<CaseDetail, "messages" | "other_cases" | "order_count"> & { conversations: { conversation_id: string; messages: CaseMessage[] }[] };
  const messages = raw.conversations.flatMap((c) => c.messages).sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  raw.notes.sort((a, b) => b.created_at.localeCompare(a.created_at));
  raw.assignments.sort((a, b) => b.assigned_at.localeCompare(a.assigned_at));
  // Names of staff who wrote in this chat (messages.sender_id has no foreign key, so look them up)
  const staffIds = [...new Set(messages.filter((m) => m.sender_type === "human_agent" && m.sender_id).map((m) => m.sender_id as string))];
  if (staffIds.length) {
    const { data: people } = await supabase.from("users").select("user_id, name").in("user_id", staffIds);
    const names = new Map((people ?? []).map((u) => [u.user_id, u.name]));
    for (const m of messages) if (m.sender_id) m.sender_name = names.get(m.sender_id);
  }
  const custId = raw.customer?.customer_id;
  const [others, orders] = custId ? await Promise.all([
    supabase.from("cases").select("case_id, case_number, subject, status, created_at").eq("customer_id", custId).neq("case_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("orders").select("order_id", { count: "exact", head: true }).eq("customer_id", custId),
  ]) : [{ data: [] }, { count: 0 }];
  const { conversations: convs, ...rest } = raw;
  return { ...rest, messages, conversation_ids: convs.map((c) => c.conversation_id), other_cases: (others.data ?? []) as CaseDetail["other_cases"], order_count: (orders as { count: number | null }).count ?? 0 };
}

export const staffTakeCase = (id: string) => rpc("staff_take_case", { p_case_id: id }, "staffTakeCase");
export const staffReply = (id: string, message: string) => rpc("staff_reply", { p_case_id: id, p_message: message }, "staffReply");
export const staffSetStatus = (id: string, status: string, note: string) => rpc("staff_set_status", { p_case_id: id, p_status: status, p_note: note }, "staffSetStatus");
export const staffAddNote = (id: string, note: string) => rpc("staff_add_note", { p_case_id: id, p_note: note }, "staffAddNote");
export const staffUpdateReturn = (id: string, status: string, note: string) => rpc("staff_update_return", { p_return_id: id, p_status: status, p_note: note }, "staffUpdateReturn");

export type QueueReturn = ReturnRequest & { order: { order_number: string } | null; customer: { user: { name: string } | null } | null };
export async function listReturnQueue(): Promise<{ data: QueueReturn[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("return_requests")
    .select(`${RETURN_COLS}, order:orders(order_number), customer:customers(user:users(name))`).order("created_at", { ascending: false });
  if (error) return { data: [], error: friendlyError(error, "listReturnQueue") };
  return { data: data as unknown as QueueReturn[] };
}

// ---------- customer ----------
export async function listMyReturns(): Promise<(ReturnRequest & { order: { order_number: string } | null })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("return_requests").select(`${RETURN_COLS}, order:orders(order_number)`).order("created_at", { ascending: false });
  if (error) console.error("[listMyReturns]", error.message);
  return (data ?? []) as unknown as (ReturnRequest & { order: { order_number: string } | null })[];
}
export const requestReturn = (orderId: string, kind: string, reason: string, details: string, items: { order_item_id: string; quantity: number; exchange_for?: string }[]) =>
  rpc("request_return", { p_order_id: orderId, p_kind: kind, p_reason: reason, p_details: details, p_items: items }, "requestReturn");
export const attachReturnPhotos = (returnId: string, paths: string[]) =>
  rpc("attach_return_photos", { p_return: returnId, p_paths: paths }, "attachReturnPhotos");

// Short-lived links (1 hour) to private return photos. Storage rules decide who may see them.
export async function signPhotos(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("return-photos").createSignedUrls(paths, 3600);
  if (error) { console.error("[signPhotos]", error.message); return {}; }
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]));
}

export const rateCase = (id: string, rating: number, comment: string) => rpc("rate_case", { p_case_id: id, p_rating: rating, p_comment: comment }, "rateCase");

export async function getMyRating(caseId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("feedback").select("rating").eq("case_id", caseId).maybeSingle();
  return data?.rating ?? null;
}

// ---------- notifications (customers and staff) ----------
export type Notice = { notification_id: string; type: string; title: string; link: string | null; read_at: string | null; created_at: string };
export async function listNotifications(limit = 50): Promise<Notice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications").select("notification_id, type, title, link, read_at, created_at")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) console.error("[listNotifications]", error.message);
  return (data ?? []) as Notice[];
}
export const unreadCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("notification_id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
});
export const markNotificationsRead = () => rpc("mark_notifications_read", {}, "markNotificationsRead");
