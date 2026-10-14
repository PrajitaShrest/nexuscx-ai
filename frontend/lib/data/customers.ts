import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "./errors";

// Staff view of customers. v_customer_overview uses security_invoker,
// so only staff with view_cases get rows (customers get none).
export type CustomerRow = {
  customer_id: string; user_id: string; name: string; email: string; phone: string | null; tier: string;
  created_at: string; last_active_at: string | null; orders: number; spent_cents: number; cases: number;
  open_cases: number; returns: number; avg_rating: number | null; last_activity: string | null;
};

export async function listCustomers(search: string): Promise<{ data: CustomerRow[]; error?: string }> {
  const supabase = await createClient();
  let q = supabase.from("v_customer_overview").select("*").order("last_activity", { ascending: false, nullsFirst: false }).limit(200);
  const s = search.replace(/[%,()*]/g, " ").trim();
  if (s) q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
  const { data, error } = await q;
  if (error) return { data: [], error: friendlyError(error, "loading customers") };
  return { data: (data ?? []) as CustomerRow[] };
}

export type CustomerDetail = CustomerRow & {
  recentCases: { case_id: string; case_number: string; subject: string | null; status: string; updated_at: string }[];
  recentOrders: { order_id: string; order_number: string; status: string; total_cents: number; created_at: string }[];
};

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();
  const [row, cases, orders] = await Promise.all([
    supabase.from("v_customer_overview").select("*").eq("customer_id", id).maybeSingle(),
    supabase.from("cases").select("case_id, case_number, subject, status, updated_at").eq("customer_id", id).order("updated_at", { ascending: false }).limit(8),
    supabase.from("orders").select("order_id, order_number, status, total_cents, created_at").eq("customer_id", id).order("created_at", { ascending: false }).limit(8),
  ]);
  if (!row.data) return null;
  return { ...(row.data as CustomerRow), recentCases: (cases.data ?? []) as CustomerDetail["recentCases"], recentOrders: (orders.data ?? []) as CustomerDetail["recentOrders"] };
}
