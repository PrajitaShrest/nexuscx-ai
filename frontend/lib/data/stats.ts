import { createClient } from "@/lib/supabase/server";
import type { Industry } from "@/lib/packs";

// Numbers and chart series for the dashboard, from public.case_stats() (migration 014).
// Row Level Security still decides which cases are counted.

export type StatsFilters = { days: number; topic: string; sentiment: string; priority: string };

// Topic filter groups the raw AI intents into the same labels used across the app.
// Each topic belongs to one industry pack (migration 017); filters show the active pack's topics.
export const TOPICS: Record<string, { label: string; intents: string[]; industry: Industry }> = {
  orders: { label: "Orders & delivery", intents: ["order_status", "return_request"], industry: "ecommerce" },
  billing: { label: "Billing & refunds", intents: ["billing_question", "refund_request"], industry: "ecommerce" },
  technical: { label: "Technical", intents: ["technical_issue"], industry: "ecommerce" },
  account: { label: "Account", intents: ["account"], industry: "ecommerce" },
  general: { label: "General", intents: ["general", "unknown"], industry: "ecommerce" },
  admissions: { label: "Admissions", intents: ["admissions"], industry: "university" },
  fees: { label: "Finance & fees", intents: ["fees"], industry: "university" },
  it_support: { label: "IT support", intents: ["it_support"], industry: "university" },
  academic: { label: "Academic, exams & results", intents: ["academic"], industry: "university" },
  student_services: { label: "Student services", intents: ["student_services"], industry: "university" },
  uni_general: { label: "General", intents: ["general", "unknown"], industry: "university" },
};
export const topicsFor = (industry: Industry) => Object.entries(TOPICS).filter(([, t]) => t.industry === industry);
export const ISSUE_LABEL: Record<string, string> = {
  order_status: "Order status", return_request: "Returns & exchanges", billing_question: "Billing questions",
  refund_request: "Refunds", technical_issue: "Technical problems", account: "Account & login", general: "General", unknown: "General",
  admissions: "Admissions", fees: "Finance & fees", it_support: "IT support", academic: "Academic, exams & results", student_services: "Student services",
};
export const SENTIMENTS = ["angry", "negative", "neutral", "positive"] as const;
export const PRIORITIES = ["urgent", "high", "medium", "normal", "low"] as const;
export const PERIODS = [7, 30, 90] as const;

export type CaseStats = {
  days: number;
  summary: { cases: number; ai_only: number; escalated: number; resolved: number; resolved_with_sla: number; resolved_in_sla: number; wait_for_person_min: number | null; hours_to_resolve: number | null };
  previous: { cases: number; ai_only: number; escalated: number };
  rating: { csat: number | null; prev_csat: number | null; ratings: number };
  daily: { day: string; new: number; escalated: number; resolved: number }[];
  outcomes: { ai_only: number; waiting: number; staff_resolved: number; with_staff: number };
  topics: { intent: string; total: number; escalated: number; resolved: number }[];
  sentiment: Record<string, number>;
  priority: Record<string, number>;
};

export function readFilters(sp: Record<string, string | undefined>): StatsFilters {
  const days = Number(sp.days);
  return {
    days: (PERIODS as readonly number[]).includes(days) ? days : 30,
    topic: sp.topic && sp.topic in TOPICS ? sp.topic : "",
    sentiment: sp.sentiment && (SENTIMENTS as readonly string[]).includes(sp.sentiment) ? sp.sentiment : "",
    priority: sp.priority && (PRIORITIES as readonly string[]).includes(sp.priority) ? sp.priority : "",
  };
}

export async function getCaseStats(f: StatsFilters): Promise<{ data: CaseStats | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("case_stats", {
    p_days: f.days,
    p_intents: f.topic ? TOPICS[f.topic].intents : null,
    p_sentiment: f.sentiment || null,
    p_priority: f.priority || null,
  });
  if (error) {
    console.error("[case_stats]", error.message);
    return { data: null, error: "The charts could not load. Has migration 014 been run in Supabase?" };
  }
  return { data: data as CaseStats };
}
