import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "./errors";

// Week 8 admin screens: audit log, AI agents, routing & escalation rules,
// settings, SLA targets, analytics breakdowns and team operations.
// Reads rely on Row Level Security; every change goes through a database
// function (migration 015) that checks permission and writes the audit log.

async function rpc(fn: string, args: Record<string, unknown>, context: string): Promise<{ data?: unknown; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { error: error.code === "22023" ? error.message : friendlyError(error, context) };
  return { data };
}

// ---------- audit log ----------
export type AuditRow = {
  log_id: string; created_at: string; actor: string; actor_type: string; action: string; entity_type: string;
  entity_id: string | null; case_id: string | null; result: string; risk_level: string; details: Record<string, unknown> | null;
};
export type AuditFilters = { days: number; who: string; area: string; risk: string; result: string; q: string; page: number };
export const AUDIT_PAGE = 50;

export async function listAudit(f: AuditFilters): Promise<{ data: AuditRow[]; count: number; error?: string }> {
  const supabase = await createClient();
  const since = new Date(Date.now() - f.days * 86400000).toISOString();
  let q = supabase.from("audit_logs").select("log_id, created_at, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details", { count: "exact" })
    .gte("created_at", since);
  if (f.who) q = q.eq("actor_type", f.who);
  if (f.area) q = q.eq("entity_type", f.area);
  if (f.risk) q = q.eq("risk_level", f.risk);
  if (f.result) q = q.eq("result", f.result);
  const text = f.q.replace(/[%,()*]/g, " ").trim();
  if (text) q = q.or(`action.ilike.%${text}%,actor.ilike.%${text}%`);
  const from = (f.page - 1) * AUDIT_PAGE;
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(from, from + AUDIT_PAGE - 1);
  if (error) return { data: [], count: 0, error: friendlyError(error, "loading the audit log") };
  return { data: (data ?? []) as AuditRow[], count: count ?? 0 };
}

export async function listAuditForExport(f: AuditFilters): Promise<AuditRow[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - f.days * 86400000).toISOString();
  let q = supabase.from("audit_logs").select("log_id, created_at, actor, actor_type, action, entity_type, entity_id, case_id, result, risk_level, details").gte("created_at", since);
  if (f.who) q = q.eq("actor_type", f.who);
  if (f.area) q = q.eq("entity_type", f.area);
  if (f.risk) q = q.eq("risk_level", f.risk);
  if (f.result) q = q.eq("result", f.result);
  const text = f.q.replace(/[%,()*]/g, " ").trim();
  if (text) q = q.or(`action.ilike.%${text}%,actor.ilike.%${text}%`);
  const { data } = await q.order("created_at", { ascending: false }).limit(5000);
  return (data ?? []) as AuditRow[];
}

export type SecurityEvent = { event_id: string; created_at: string; event_type: string; severity: string; description: string | null; action_taken: string | null; case_id: string | null };
export async function listSecurityEvents(days: number): Promise<SecurityEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("security_events").select("event_id, created_at, event_type, severity, description, action_taken, case_id")
    .gte("created_at", new Date(Date.now() - days * 86400000).toISOString()).order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as SecurityEvent[];
}

// ---------- AI agents ----------
export type Agent = {
  agent_id: string; name: string; type: string; description: string | null; model_name: string | null; status: string;
  department: string | null; health: string; system_instructions: string | null; updated_at: string;
  requests: number; resolution_pct: number | null; escalation_pct: number | null; avg_confidence_pct: number | null; intents: string[];
};

export async function listAgents(): Promise<{ data: Agent[]; error?: string }> {
  const supabase = await createClient();
  const [agents, perf, routes] = await Promise.all([
    supabase.from("ai_agents").select("agent_id, name, type, description, model_name, status, department, health, system_instructions, updated_at").order("type").order("name"),
    supabase.from("v_agent_performance").select("agent_id, requests, resolution_pct, escalation_pct, avg_confidence_pct"),
    supabase.from("routing_rules").select("agent_id, intent, status").eq("status", "active"),
  ]);
  if (agents.error) return { data: [], error: friendlyError(agents.error, "loading AI agents") };
  const p = new Map(((perf.data ?? []) as { agent_id: string }[]).map((r) => [r.agent_id, r]));
  return {
    data: (agents.data ?? []).map((a) => ({
      requests: 0, resolution_pct: null, escalation_pct: null, avg_confidence_pct: null, ...a, ...(p.get(a.agent_id) ?? {}),
      intents: ((routes.data ?? []) as { agent_id: string | null; intent: string | null }[]).filter((r) => r.agent_id === a.agent_id && r.intent).map((r) => r.intent as string),
    })) as Agent[],
  };
}

export const updateAgent = (id: string, status: string, instructions: string) =>
  rpc("update_ai_agent", { p_agent: id, p_status: status, p_instructions: instructions }, "updating the agent");

// ---------- routing & escalation ----------
export type RoutingRule = { rule_id: string; name: string; intent: string | null; agent_id: string | null; action: string; priority: number; status: string };
export type EscalationRule = { rule_id: string; name: string; condition_type: string; threshold_value: string | null; severity: string; action: string; priority: number; status: string };

export async function listRules(): Promise<{ routing: RoutingRule[]; escalation: EscalationRule[]; agents: { agent_id: string; name: string; status: string }[]; error?: string }> {
  const supabase = await createClient();
  const [r, e, a] = await Promise.all([
    supabase.from("routing_rules").select("rule_id, name, intent, agent_id, action, priority, status").order("priority"),
    supabase.from("escalation_rules").select("rule_id, name, condition_type, threshold_value, severity, action, priority, status").order("priority"),
    supabase.from("ai_agents").select("agent_id, name, status, type").in("type", ["specialist", "orchestrator"]).order("name"),
  ]);
  const err = r.error ?? e.error ?? a.error;
  return {
    routing: (r.data ?? []) as RoutingRule[], escalation: (e.data ?? []) as EscalationRule[],
    agents: (a.data ?? []) as { agent_id: string; name: string; status: string }[],
    error: err ? friendlyError(err, "loading rules") : undefined,
  };
}

export const updateRoutingRule = (id: string, agent: string | null, status: string, priority: number) =>
  rpc("update_routing_rule", { p_rule: id, p_agent: agent, p_status: status, p_priority: priority }, "saving the routing rule");
export const updateEscalationRule = (id: string, status: string, threshold: string, severity: string, action: string, priority: number) =>
  rpc("update_escalation_rule", { p_rule: id, p_status: status, p_threshold: threshold, p_severity: severity, p_action: action, p_priority: priority }, "saving the escalation rule");

// ---------- settings & SLA ----------
export type Setting = { setting_key: string; value: unknown; category: string; description: string | null; updated_at: string; updated_by_name: string | null };
export type SlaPolicy = { priority: string; first_response_minutes: number; resolution_minutes: number };

export async function listSettings(): Promise<{ settings: Setting[]; sla: SlaPolicy[]; error?: string }> {
  const supabase = await createClient();
  const [s, p] = await Promise.all([
    supabase.from("platform_settings").select("setting_key, value, category, description, updated_at, updated_by").order("category").order("setting_key"),
    supabase.from("sla_policies").select("priority, first_response_minutes, resolution_minutes"),
  ]);
  const ids = [...new Set(((s.data ?? []) as { updated_by: string | null }[]).map((r) => r.updated_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from("users").select("user_id, name").in("user_id", ids);
    for (const u of (data ?? []) as { user_id: string; name: string }[]) names.set(u.user_id, u.name);
  }
  const order = ["urgent", "high", "medium", "normal", "low"];
  return {
    settings: ((s.data ?? []) as (Setting & { updated_by: string | null })[]).map((r) => ({ ...r, updated_by_name: r.updated_by ? names.get(r.updated_by) ?? null : null })),
    sla: ((p.data ?? []) as SlaPolicy[]).sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority)),
    error: s.error ? friendlyError(s.error, "loading settings") : undefined,
  };
}

export const updateSetting = (key: string, value: unknown) => rpc("update_setting", { p_key: key, p_value: value }, "saving the setting");
export const updateSla = (priority: string, first: number, resolution: number) =>
  rpc("update_sla_policy", { p_priority: priority, p_first: first, p_resolution: resolution }, "saving the SLA");

// ---------- analytics & team ----------
export type Breakdowns = {
  escalation_reasons: { reason: string; n: number }[]; ratings: Record<string, number>; hours: number[]; weekdays: number[];
  top_articles: { title: string; n: number }[]; security: Record<string, number>;
  agents: { name: string; department: string | null; status: string; requests: number; ai_only: number; escalated: number; confidence: number | null }[];
};
export async function getBreakdowns(days: number) {
  const r = await rpc("analytics_breakdowns", { p_days: days }, "loading analytics");
  return { data: (r.data as Breakdowns | undefined) ?? null, error: r.error };
}

export type TeamStats = {
  people: { user_id: string; name: string; role: string; team: string | null; presence: string; max_active_cases: number; last_active_at: string | null;
    active_cases: number; taken: number; resolved: number; pickup_min: number | null; rating: number | null; replies: number }[];
  queue: { waiting: number; oldest_wait_min: number | null; sla_breached: number; unassigned_high: number };
};
export async function getTeamStats(days: number) {
  const r = await rpc("team_stats", { p_days: days }, "loading team operations");
  return { data: (r.data as TeamStats | undefined) ?? null, error: r.error };
}
