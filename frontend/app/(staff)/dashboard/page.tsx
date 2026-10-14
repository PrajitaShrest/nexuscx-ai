import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import { CATEGORY, STATUS, Pill } from "@/components/Badges";
import { PRESENCE } from "@/components/Avatar";
import { can, getMe, ROLE_LABEL } from "@/lib/data/me";
import { getDashboard, type DashCase } from "@/lib/data/dashboard";
import { ago, greeting } from "@/lib/format";

function sla(due: string | null) {
  if (!due) return { text: "—", late: false };
  const mins = Math.round((new Date(due).getTime() - Date.now()) / 60000);
  if (mins < 0) return { text: "Overdue", late: true };
  return { text: mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`, late: mins < 60 };
}

function CaseList({ cases, empty }: { cases: DashCase[]; empty: string }) {
  if (cases.length === 0) return <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-gray-500">{empty}</p>;
  return (
    <ul className="divide-y">
      {cases.map((c) => {
        const s = sla(c.sla_due_at);
        return (
          <li key={c.case_id}>
            <Link href={`/cases/${c.case_id}`} className="flex items-center gap-3 py-2.5 hover:bg-indigo-50/40">
              <span className="w-20 shrink-0 text-sm font-medium text-indigo-700">{c.case_number}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{c.subject}</span>
              <span className={`w-16 shrink-0 text-right text-xs ${s.late ? "font-semibold text-red-600" : "text-gray-500"}`}>{s.text}</span>
              <Pill map={STATUS} value={c.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Tile({ label, value, href, tone, hint }: { label: string; value: string | number; href?: string; tone?: string; hint?: string }) {
  const body = (
    <>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </>
  );
  return href ? <Link href={href} className="rounded-xl border bg-white px-4 py-3 transition hover:border-indigo-300 hover:shadow-sm">{body}</Link>
    : <div className="rounded-xl border bg-white px-4 py-3">{body}</div>;
}

// Staff home: what needs doing now. Numbers depend on the person's roles.
export default async function DashboardPage() {
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Dashboard" needs="view_cases" />;
  const d = await getDashboard(me);
  const k = d.kpis;
  const roles = [me.role, ...me.extraRoles].map((r) => ROLE_LABEL[r] ?? r).join(" + ");
  const maxIntent = Math.max(1, ...d.byIntent.map((i) => i.count));

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/dashboard" />
      <main className="min-w-0 flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-xl font-semibold">{greeting()}, {me.name.split(" ")[0]}</h1>
          <p className="text-sm text-gray-500">{roles}{me.team ? ` · ${me.team}` : ""} · live from the database</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Tile label="My open cases" value={d.myCases.length} href="#mine" />
          <Tile label="Waiting for a person" value={d.waitingCount} href="/conversations?tab=escalated" tone={d.waitingCount ? "text-red-600" : ""} />
          <Tile label="SLA due within 1h" value={d.slaRisk} href="/cases" tone={d.slaRisk ? "text-amber-600" : ""} />
          <Tile label="New today" value={d.openToday} hint={`${d.resolvedToday} resolved today`} />
          <Tile label="Orders to process" value={d.ordersToProcess} href="/orders" />
          <Tile label="Returns to review" value={d.returnsToReview} href="/returns" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section id="mine" className="rounded-xl border bg-white p-4 xl:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">My cases</h2>
              <span className="text-xs text-gray-500">Cases you have taken over</span>
            </div>
            <CaseList cases={d.myCases} empty="You have no cases. Take one from the queue below." />
            <div className="mb-2 mt-6 flex items-center justify-between">
              <h2 className="font-semibold">Next in the human queue</h2>
              <Link href="/conversations?tab=escalated" className="text-xs font-semibold text-indigo-700 hover:underline">See all {d.waitingCount}</Link>
            </div>
            <CaseList cases={d.waiting} empty="Nobody is waiting. The AI is handling everything right now." />
          </section>

          <section className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Open cases by topic</h2>
            {d.byIntent.length === 0 ? <p className="text-sm text-gray-500">No open cases.</p> : (
              <ul className="space-y-2.5">
                {d.byIntent.map((i) => (
                  <li key={i.intent} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0"><Pill map={CATEGORY} value={i.intent} /></span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"><span className="block h-full rounded-full bg-indigo-500" style={{ width: `${(i.count / maxIntent) * 100}%` }} /></span>
                    <span className="w-6 text-right font-medium">{i.count}</span>
                  </li>
                ))}
              </ul>
            )}
            {k && (
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                <div><dt className="text-xs text-gray-500">AI resolution</dt><dd className="font-semibold">{k.ai_resolution_pct ?? 0}%</dd></div>
                <div><dt className="text-xs text-gray-500">Escalations</dt><dd className="font-semibold">{k.human_escalations}</dd></div>
                <div><dt className="text-xs text-gray-500">High-risk open</dt><dd className="font-semibold text-red-600">{k.open_high_risk_cases}</dd></div>
                <div><dt className="text-xs text-gray-500">Customer rating</dt><dd className="font-semibold">{k.csat !== null ? `${k.csat} / 5` : "—"}</dd></div>
              </dl>
            )}
          </section>
        </div>

        {can(me, "view_analytics") && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-xl border bg-white p-4">
              <h2 className="mb-3 font-semibold">AI agents</h2>
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-gray-500"><tr>{["Agent", "Requests", "Resolved", "Escalated", "Confidence"].map((h) => <th key={h} className="pb-2">{h}</th>)}</tr></thead>
                <tbody className="divide-y">
                  {d.agents.map((a) => (
                    <tr key={a.name}><td className="py-2"><p className="font-medium">{a.name}</p><p className="text-xs text-gray-500">{a.department}</p></td>
                      <td>{a.requests}</td><td>{a.resolution_pct ?? 0}%</td><td>{a.escalation_pct ?? 0}%</td><td>{a.avg_confidence_pct ?? "—"}%</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="rounded-xl border bg-white p-4">
              <h2 className="mb-3 font-semibold">Team workload</h2>
              {d.team.length === 0 ? <p className="text-sm text-gray-500">No staff to show.</p> : (
                <ul className="space-y-2.5">
                  {d.team.map((t) => (
                    <li key={t.name} className="flex items-center gap-3 text-sm">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PRESENCE[t.presence]?.dot ?? "bg-gray-300"}`} title={PRESENCE[t.presence]?.label} />
                      <span className="w-36 shrink-0 truncate"><span className="font-medium">{t.name}</span><span className="block text-xs text-gray-500">{t.team ?? "No team"}</span></span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"><span className={`block h-full rounded-full ${t.active_cases >= t.max_active_cases ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (t.active_cases / Math.max(1, t.max_active_cases)) * 100)}%` }} /></span>
                      <span className="w-12 text-right text-xs text-gray-500">{t.active_cases}/{t.max_active_cases}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
        <p className="text-xs text-gray-400">Updated {ago(new Date().toISOString())}. Refresh the page for the latest numbers.</p>
      </main>
    </div>
  );
}
