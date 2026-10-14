import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "./errors";

export type CaseRow = {
  case_id: string;
  case_number: string;
  customer_name: string;
  customer_tier: string;
  subject: string | null;
  intent: string | null;
  priority: string;
  sentiment: string | null;
  risk: string | null;
  confidence: string | null;
  status: string;
  assigned_to: string | null;
  sla_minutes_left: number | null;
  created_at: string;
};

export type EnquiryResult = {
  case_number: string;
  status: string;
  intent: string;
  sentiment: string;
  urgency: string;
  risk: string;
  confidence: number;
  routed_to: string;
  escalation_rule: string | null;
  reply: string;
  source: string | null;
};

// Staff: every case. Customers: only their own (enforced by RLS, not here).
export type CaseFilters = { q?: string; status?: string; intents?: string[]; priority?: string; sentiment?: string; assigned?: string; myName?: string; sla?: string };

export async function listCaseQueue(f: CaseFilters = {}): Promise<{ data: CaseRow[]; error?: string }> {
  const supabase = await createClient();
  let q = supabase.from("v_case_queue").select("*");
  if (f.status === "all") { /* everything, including closed */ }
  else if (f.status === "open") q = q.not("status", "in", "(resolved,closed)");
  else if (f.status) q = q.eq("status", f.status);
  else q = q.neq("status", "closed");
  if (f.intents?.length) q = q.in("intent", f.intents);
  if (f.priority) q = q.eq("priority", f.priority);
  if (f.sentiment) q = q.eq("sentiment", f.sentiment);
  if (f.assigned === "me" && f.myName) q = q.eq("assigned_to", f.myName);
  if (f.assigned === "nobody") q = q.is("assigned_to", null);
  if (f.sla === "risk") q = q.lt("sla_minutes_left", 60).not("status", "in", "(resolved,closed)");
  const text = (f.q ?? "").replace(/[%,()*]/g, " ").trim();
  if (text) q = q.or(`case_number.ilike.%${text}%,customer_name.ilike.%${text}%,subject.ilike.%${text}%`);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(300);
  if (error) return { data: [], error: friendlyError(error, "listCaseQueue") };
  return { data: data as CaseRow[] };
}

// Core feature: send one enquiry. The database classifies, routes,
// escalates and replies inside submit_enquiry() in one transaction.
export async function submitEnquiry(message: string): Promise<{ data?: EnquiryResult; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_enquiry", { p_message: message });
  if (error) return { error: friendlyError(error, "submitEnquiry") };
  return { data: data as EnquiryResult };
}
