import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import FilterBar from "@/components/FilterBar";
import { can, getMe } from "@/lib/data/me";
import { AUDIT_PAGE, listAudit, listSecurityEvents, type AuditFilters } from "@/lib/data/ops";
import { actionLabel, AREA_LABEL, detailLines } from "@/lib/audit-format";
import { dayTime } from "@/lib/format";

const RISK: Record<string, string> = { low: "bg-gray-100 text-gray-700", medium: "bg-amber-100 text-amber-800", high: "bg-orange-100 text-orange-800", critical: "bg-red-100 text-red-800" };
const RESULT: Record<string, string> = { success: "text-emerald-700", blocked: "text-red-700 font-semibold", failed: "text-red-700" };
const WHO: Record<string, string> = { human: "Person", ai_agent: "AI", system: "System" };
const pick = (v: string | undefined, list: string[]) => (v && list.includes(v) ? v : "");

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await getMe();
  if (!can(me, "view_audit_logs")) return <NoAccess me={me} page="Audit Logs" needs="view_audit_logs" />;
  const sp = await searchParams;
  const f: AuditFilters = {
    days: [1, 7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30,
    who: pick(sp.who, ["human", "ai_agent", "system"]), area: pick(sp.area, Object.keys(AREA_LABEL)),
    risk: pick(sp.risk, ["low", "medium", "high", "critical"]), result: pick(sp.result, ["success", "blocked", "failed"]),
    q: (sp.q ?? "").slice(0, 60), page: Math.max(1, Number(sp.page) || 1),
  };
  const tab = sp.tab === "security" ? "security" : "activity";
  const [{ data: rows, count, error }, events] = await Promise.all([
    tab === "activity" ? listAudit(f) : Promise.resolve({ data: [], count: 0, error: undefined }),
    tab === "security" ? listSecurityEvents(f.days) : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(count / AUDIT_PAGE));
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v !== undefined && v !== "") p.set(k, String(v));
    return `?${p}`;
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/audit" />
      <main className="min-w-0 flex-1 p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Audit Logs</h1>
            <p className="text-sm text-gray-500">Every action by people, the AI and the system. Entries cannot be edited or deleted.</p>
          </div>
          {tab === "activity" && (
            <a href={`/audit/export${qs({ page: "" })}`} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Download CSV</a>
          )}
        </div>
        <nav className="mb-4 flex gap-2" aria-label="Log type">
          {[["activity", "Activity"], ["security", "Security events"]].map(([t, l]) => (
            <Link key={t} href={qs({ tab: t, page: "" })} aria-current={tab === t ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-sm ${tab === t ? "bg-indigo-600 text-white" : "border bg-white text-gray-700 hover:bg-gray-50"}`}>{l}</Link>
          ))}
        </nav>
        <div className="mb-4">
          <FilterBar keep={["tab"]} search={tab === "activity" ? { name: "q", label: "Search", placeholder: "Action or person" } : undefined} filters={[
            { name: "days", label: "Period", options: [["1", "Last 24 hours"], ["7", "Last 7 days"], ["", "Last 30 days"], ["90", "Last 90 days"]] },
            ...(tab === "activity" ? [
              { name: "who", label: "Done by", options: [["", "Anyone"], ["human", "People"], ["ai_agent", "AI"], ["system", "System"]] as [string, string][] },
              { name: "area", label: "Area", options: [["", "All areas"], ...Object.entries(AREA_LABEL)] as [string, string][] },
              { name: "risk", label: "Risk", options: [["", "Any risk"], ["low", "Low"], ["medium", "Medium"], ["high", "High"], ["critical", "Critical"]] as [string, string][] },
              { name: "result", label: "Result", options: [["", "Any result"], ["success", "Success"], ["blocked", "Blocked"], ["failed", "Failed"]] as [string, string][] },
            ] : []),
          ]} />
        </div>
        {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-red-700">{error}</p>}

        {tab === "activity" ? (
          <>
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>{["When", "Who", "Action", "Area", "Risk", "Result", "Details"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y align-top">
                  {rows.map((r) => {
                    const lines = detailLines(r.details);
                    return (
                      <tr key={r.log_id}>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500 tabular-nums">{dayTime(r.created_at)}</td>
                        <td className="px-4 py-3"><span className="font-medium">{r.actor}</span><span className="ml-1.5 rounded bg-gray-100 px-1.5 text-[11px] text-gray-600">{WHO[r.actor_type] ?? r.actor_type}</span></td>
                        <td className="px-4 py-3">{actionLabel(r.action)}{r.case_id && <Link href={`/cases/${r.case_id}`} className="ml-1.5 text-xs text-indigo-700 hover:underline">case</Link>}</td>
                        <td className="whitespace-nowrap px-4 py-3">{AREA_LABEL[r.entity_type] ?? r.entity_type}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${RISK[r.risk_level] ?? RISK.low}`}>{r.risk_level}</span></td>
                        <td className={`px-4 py-3 capitalize ${RESULT[r.result] ?? ""}`}>{r.result}</td>
                        <td className="max-w-md px-4 py-3 text-xs text-gray-600">
                          {lines.length === 0 ? "—" : lines.length <= 2 ? lines.map((l) => <p key={l}>{l}</p>) : (
                            <details><summary className="cursor-pointer">{lines[0]}</summary>{lines.slice(1).map((l) => <p key={l}>{l}</p>)}</details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No activity matches these filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
              <span>{count} entries · page {f.page} of {pages}</span>
              <span className="flex gap-2">
                {f.page > 1 && <Link href={qs({ page: f.page - 1 })} className="rounded-lg border bg-white px-3 py-1.5 hover:bg-gray-50">Newer</Link>}
                {f.page < pages && <Link href={qs({ page: f.page + 1 })} className="rounded-lg border bg-white px-3 py-1.5 hover:bg-gray-50">Older</Link>}
              </span>
            </div>
          </>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>{["When", "Event", "Severity", "What happened", "Action taken"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y align-top">
                {events.map((e) => (
                  <tr key={e.event_id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500 tabular-nums">{dayTime(e.created_at)}</td>
                    <td className="px-4 py-3 font-medium">{actionLabel(e.event_type)}{e.case_id && <Link href={`/cases/${e.case_id}`} className="ml-1.5 text-xs text-indigo-700 hover:underline">case</Link>}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${RISK[e.severity] ?? RISK.low}`}>{e.severity}</span></td>
                    <td className="max-w-md px-4 py-3 text-gray-700">{e.description ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{e.action_taken ?? "—"}</td>
                  </tr>
                ))}
                {events.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No security events in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
