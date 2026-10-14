import { getMe, can } from "@/lib/data/me";
import { listAuditForExport } from "@/lib/data/ops";
import { actionLabel, AREA_LABEL, detailLines } from "@/lib/audit-format";

// CSV download of the audit log with the same filters as the page.
// Permission is checked here and again by Row Level Security on audit_logs.
const cell = (v: string) => {
  const s = /^[=+\-@]/.test(v) ? `'${v}` : v; // stop spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const me = await getMe();
  if (!can(me, "view_audit_logs")) return new Response("Not allowed", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const one = (k: string, list: string[]) => (list.includes(sp.get(k) ?? "") ? (sp.get(k) as string) : "");
  const rows = await listAuditForExport({
    days: [1, 7, 30, 90].includes(Number(sp.get("days"))) ? Number(sp.get("days")) : 30,
    who: one("who", ["human", "ai_agent", "system"]), area: one("area", Object.keys(AREA_LABEL)),
    risk: one("risk", ["low", "medium", "high", "critical"]), result: one("result", ["success", "blocked", "failed"]),
    q: (sp.get("q") ?? "").slice(0, 60), page: 1,
  });
  const lines = [["Time (UTC)", "Who", "Type", "Action", "Area", "Risk", "Result", "Details"].join(",")];
  for (const r of rows) {
    lines.push([r.created_at, r.actor, r.actor_type, actionLabel(r.action), AREA_LABEL[r.entity_type] ?? r.entity_type, r.risk_level, r.result, detailLines(r.details).join("; ")].map(cell).join(","));
  }
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="nexuscx-audit-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
