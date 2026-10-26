import { createClient } from "@/lib/supabase/server";
import type { Me } from "./me";

// Staff dashboard: everything comes from the database, filtered by Row Level Security.
// Sections a role cannot use are not loaded at all.

export type DashCase = { case_id: string; case_number: string; subject: string | null; status: string; priority: string; sla_due_at: string | null; updated_at: string };
export type Dashboard = {
  kpis: { total_conversations: number; ai_resolution_pct: number | null; human_escalations: number; csat: number | null; open_high_risk_cases: number; approved_documents: number } | null;
  myCases: DashCase[];
  waiting: DashCase[];
  waitingCount: number;
  slaRisk: number;
  openToday: number;
  resolvedToday: number;
  ordersToProcess: number;
  returnsToReview: number;
  agents: { name: string; department: string; requests: number; resolution_pct: number | null; escalation_pct: number | null; avg_confidence_pct: number | null }[];
  team: { name: string; team: string | null; presence: string; active_cases: number; max_active_cases: number }[];
  byIntent: { intent: string; count: number }[];
};

const CASE_COLS = "case_id, case_number, subject, status, priority, sla_due_at, updated_at";

export async function getDashboard(me: Me): Promise<Dashboard> {
  const supabase = await createClient();
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const soon = new Date(Date.now() + 60 * 60000).toISOString();
  const analytics = me.permissions.includes("view_analytics");
  const open = ["ai_handling", "human_handling", "waiting", "escalated"];

  const [kpis, mine, waiting, sla, today, resolved, orders, returns, agents, team, intents] = await Promise.all([
    supabase.from("v_dashboard_kpis").select("*").maybeSingle(),
    supabase.from("case_assignments").select(`cases(${CASE_COLS})`).eq("user_id", me.user_id).eq("status", "active"),
    supabase.from("cases").select(CASE_COLS, { count: "exact" }).eq("status", "escalated").order("created_at").limit(5),
    supabase.from("cases").select("case_id", { count: "exact", head: true }).in("status", open).lt("sla_due_at", soon),
    supabase.from("cases").select("case_id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
    supabase.from("cases").select("case_id", { count: "exact", head: true }).in("status", ["resolved", "closed"]).gte("updated_at", since.toISOString()),
    supabase.from("orders").select("order_id", { count: "exact", head: true }).eq("status", "placed"),
    supabase.from("return_requests").select("return_id", { count: "exact", head: true }).eq("status", "requested"),
    analytics ? supabase.from("v_agent_performance").select("name, department, requests, resolution_pct, escalation_pct, avg_confidence_pct").order("requests", { ascending: false })
      : Promise.resolve({ data: [] }),
    analytics ? supabase.from("v_team_workload").select("name, team, presence, active_cases, max_active_cases").order("active_cases", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("cases").select("intent").in("status", open),
  ]);

  const counts = new Map<string, number>();
  // Intents that share a topic label are counted together (e.g. returns under Order).
  const SAME_TOPIC: Record<string, string> = { return_request: "order_status", refund_request: "billing_question", unknown: "general" };
  for (const r of (intents.data ?? []) as { intent: string | null }[]) {
    const key = SAME_TOPIC[r.intent ?? "unknown"] ?? r.intent ?? "general";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const myCases = ((mine.data ?? []) as unknown as { cases: DashCase | null }[]).map((r) => r.cases).filter((c): c is DashCase => !!c && c.status !== "closed");

  return {
    kpis: (kpis.data as Dashboard["kpis"]) ?? null,
    myCases,
    waiting: (waiting.data ?? []) as DashCase[],
    waitingCount: waiting.count ?? 0,
    slaRisk: sla.count ?? 0,
    openToday: today.count ?? 0,
    resolvedToday: resolved.count ?? 0,
    ordersToProcess: orders.count ?? 0,
    returnsToReview: returns.count ?? 0,
    agents: (agents.data ?? []) as Dashboard["agents"],
    team: (team.data ?? []) as Dashboard["team"],
    byIntent: [...counts.entries()].map(([intent, count]) => ({ intent, count })).sort((a, b) => b.count - a.count),
  };
}
