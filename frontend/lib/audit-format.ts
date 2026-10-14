// Turns stored audit actions and details into plain English for the Audit Logs page and the CSV export.

export const AREA_LABEL: Record<string, string> = {
  cases: "Cases", users: "Users", knowledge_documents: "Knowledge", ai_agents: "AI agents", routing_rules: "Routing",
  escalation_rules: "Escalation", platform_settings: "Settings", sla_policies: "SLA", orders: "Orders", return_requests: "Returns",
  messages: "Messages", customers: "Customers",
};

export function actionLabel(a: string) {
  const s = a.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "none";
  if (typeof v === "boolean") return v ? "on" : "off";
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k.replace(/_/g, " ")} ${show(x)}`).join(", ");
  return String(v);
}

// Short readable summary of the details JSON, e.g. "status: active → testing".
export function detailLines(d: Record<string, unknown> | null): string[] {
  if (!d) return [];
  const lines: string[] = [];
  const before = d.before as Record<string, unknown> | undefined;
  const after = d.after as Record<string, unknown> | undefined;
  for (const [k, v] of Object.entries(d)) {
    if (k === "before" || k === "after") continue;
    lines.push(`${k.replace(/_/g, " ")}: ${show(v)}`);
  }
  if (before && after && typeof before === "object" && typeof after === "object") {
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) lines.push(`${k.replace(/_/g, " ")}: ${show(before[k])} → ${show(after[k])}`);
    }
  } else if (before !== undefined || after !== undefined) {
    lines.push(`changed: ${show(before)} → ${show(after)}`);
  }
  return lines;
}
