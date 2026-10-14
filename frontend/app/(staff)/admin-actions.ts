"use server";

import { revalidatePath } from "next/cache";
import { updateAgent, updateEscalationRule, updateRoutingRule, updateSetting, updateSla } from "@/lib/data/ops";

// Server actions for the AI Agents, Routing & Escalation and Settings pages.
// The database functions check the configure_ai permission and every rule again.
export type AdminFormState = { error?: string; ok?: string; at?: number };

const done = (paths: string[], ok: string): AdminFormState => {
  for (const p of paths) revalidatePath(p);
  revalidatePath("/audit");
  return { ok, at: Date.now() };
};
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Number.parseInt(str(f, k), 10);

export async function saveAgent(_p: AdminFormState, f: FormData): Promise<AdminFormState> {
  const r = await updateAgent(str(f, "agent_id"), str(f, "status"), str(f, "instructions"));
  return r.error ? { error: r.error } : done(["/ai-agents", "/routing"], str(f, "status") === "testing" ? "Paused. Its topics now go to people." : "Saved.");
}

export async function saveRouting(_p: AdminFormState, f: FormData): Promise<AdminFormState> {
  const r = await updateRoutingRule(str(f, "rule_id"), str(f, "agent_id") || null, f.get("active") === "on" ? "active" : "inactive", int(f, "priority"));
  return r.error ? { error: r.error } : done(["/routing", "/ai-agents"], "Saved.");
}

export async function saveEscalation(_p: AdminFormState, f: FormData): Promise<AdminFormState> {
  const r = await updateEscalationRule(str(f, "rule_id"), f.get("active") === "on" ? "active" : "inactive", str(f, "threshold"), str(f, "severity"), str(f, "action"), int(f, "priority"));
  return r.error ? { error: r.error } : done(["/routing", "/settings"], "Saved.");
}

export async function saveSetting(_p: AdminFormState, f: FormData): Promise<AdminFormState> {
  const kind = str(f, "kind");
  const raw = str(f, "value");
  let value: unknown = raw;
  if (kind === "boolean") value = f.get("value") === "on";
  if (kind === "number") {
    value = Number(raw);
    if (!Number.isFinite(value)) return { error: "Enter a number." };
  }
  const r = await updateSetting(str(f, "key"), value);
  return r.error ? { error: r.error } : done(["/settings", "/routing"], "Saved.");
}

export async function saveSla(_p: AdminFormState, f: FormData): Promise<AdminFormState> {
  const r = await updateSla(str(f, "priority"), int(f, "first"), int(f, "resolution"));
  return r.error ? { error: r.error } : done(["/settings"], "Saved. New cases use these targets.");
}
