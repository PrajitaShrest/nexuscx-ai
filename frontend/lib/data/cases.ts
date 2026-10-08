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
export async function listCaseQueue(): Promise<{ data: CaseRow[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_case_queue")
    .select("*")
    .neq("status", "closed")
    .order("created_at", { ascending: false });
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
