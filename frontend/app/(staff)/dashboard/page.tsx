import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import { CATEGORY, STATUS, Pill } from "@/components/Badges";
import { PRESENCE } from "@/components/Avatar";
import { can, getMe, ROLE_LABEL } from "@/lib/data/me";
import { getDashboard, type DashCase } from "@/lib/data/dashboard";
import { ago, greeting } from "@/lib/format";
import FilterBar from "@/components/FilterBar";
import { LabelBars, SplitBars, StackBar, TrendChart } from "@/components/charts/Charts";
import { SENTIMENT_COLOR, SERIES } from "@/components/charts/palette";
import { getCaseStats, ISSUE_LABEL, PERIODS, PRIORITIES, readFilters, SENTIMENTS, TOPICS } from "@/lib/data/stats";

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

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Group intents that share a label (e.g. "general" and "unknown" are both "General").
function issueRows(topics: { intent: string; total: number; escalated: number }[]) {
  const m = new Map<string, { label: string; part: number; total: number }>();
  for (const t of topics) {
    const label = ISSUE_LABEL[t.intent] ?? cap(t.intent.replace(/_/g, " "));
    const r = m.get(label) ?? { label, part: 0, total: 0 };
    r.part += t.escalated; r.total += t.total; m.set(label, r);
  }
  return [...m.values()].sort((a, b) => b.total - a.total).map((r) => ({ ...r, note: `${pct(r.part, r.total)}% escalated` }));
}

// A headline number with its change against the previous period of the same length.
function Stat({ label, value, delta, goodWhenUp, hint }: { label: string; value: string; delta?: number | null; goodWhenUp?: boolean; hint?: string }) {
  const show = delta !== undefined && delta !== null && Number.isFinite(delta);
  const good = show && delta !== 0 && (goodWhenUp === undefined ? null : (delta > 0) === goodWhenUp);
  return (
    <div className="rounded-xl border bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {show ? (
        <p className={`mt-0.5 text-xs ${good === null || delta === 0 ? "text-gray-500" : good ? "text-emerald-700" : "text-red-700"}`}>
          <span aria-hidden>{delta! > 0 ? "▲" : delta! < 0 ? "▼" : "•"}</span> {delta! > 0 ? "+" : ""}{delta}{hint ?? ""} <span className="text-gray-400">vs previous period</span>
        </p>
      ) : hint ? <p className="mt-0.5 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}

// Staff home: what needs doing now, then how the service is performing.
// Numbers depend on the person's roles; the filters scope the performance section.
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Dashboard" needs="view_cases" />;
  const f = readFilters(await searchParams);
  const [d, { data: st, error: statsError }] = await Promise.all([getDashboard(me), getCaseStats(f)]);
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
          <Tile label="My open cases" value={d.myCases.length} href="/cases?assigned=me" />
          <Tile label="Waiting for a person" value={d.waitingCount} href="/conversations?tab=escalated" tone={d.waitingCount ? "text-red-600" : ""} />
          <Tile label="SLA due within 1h" value={d.slaRisk} href="/cases?sla=risk" tone={d.slaRisk ? "text-amber-600" : ""} />
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


        <section aria-labelledby="perf" className="space-y-4 border-t pt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="perf" className="text-lg font-semibold">Service performance</h2>
              <p className="text-sm text-gray-500">Cases created in the last {f.days} days{f.topic ? ` · ${TOPICS[f.topic].label}` : ""}{f.sentiment ? ` · ${f.sentiment} customers` : ""}{f.priority ? ` · ${f.priority} priority` : ""}</p>
            </div>
          </div>
          <FilterBar filters={[
            { name: "days", label: "Period", options: PERIODS.map((p) => [String(p), `Last ${p} days`] as [string, string]) },
            { name: "topic", label: "Issue", options: [["", "All issues"], ...Object.entries(TOPICS).map(([k, t]) => [k, t.label] as [string, string])] },
            { name: "sentiment", label: "Sentiment", options: [["", "All sentiment"], ...SENTIMENTS.map((s) => [s, cap(s)] as [string, string])] },
            { name: "priority", label: "Priority", options: [["", "All priorities"], ...PRIORITIES.map((p) => [p, cap(p)] as [string, string])] },
          ]} />
          {statsError && <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{statsError}</p>}
          {st && (() => {
            const s = st.summary, p = st.previous;
            const aiPct = pct(s.ai_only, s.cases), escPct = pct(s.escalated, s.cases);
            return (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  <Stat label="Cases" value={String(s.cases)} delta={s.cases - p.cases} />
                  <Stat label="Handled by AI only" value={`${aiPct}%`} delta={p.cases ? aiPct - pct(p.ai_only, p.cases) : null} goodWhenUp hint=" pts" />
                  <Stat label="Escalated to a person" value={`${escPct}%`} delta={p.cases ? escPct - pct(p.escalated, p.cases) : null} goodWhenUp={false} hint=" pts" />
                  <Stat label="Resolved within SLA" value={s.resolved_with_sla ? `${pct(s.resolved_in_sla, s.resolved_with_sla)}%` : "—"} hint={`${s.resolved} resolved`} />
                  <Stat label="Average wait for a person" value={s.wait_for_person_min !== null ? (s.wait_for_person_min < 60 ? `${s.wait_for_person_min} min` : `${Math.round(s.wait_for_person_min / 6) / 10} h`) : "—"} hint={s.hours_to_resolve !== null ? `${s.hours_to_resolve} h to resolve on average` : undefined} />
                  <Stat label="Customer rating" value={st.rating.csat !== null ? `${st.rating.csat} / 5` : "—"}
                    delta={st.rating.csat !== null && st.rating.prev_csat !== null ? Math.round((st.rating.csat - st.rating.prev_csat) * 10) / 10 : null} goodWhenUp hint={st.rating.prev_csat === null ? `${st.rating.ratings} ratings` : undefined} />
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                  <section className="rounded-xl border bg-white p-4 xl:col-span-2">
                    <h3 className="font-semibold">New, escalated and resolved cases per day</h3>
                    <p className="mb-3 text-xs text-gray-500">Hover or use the arrow keys to see each day.</p>
                    <TrendChart title="New, escalated and resolved cases per day" data={st.daily} series={[
                      { key: "new", label: "New", color: SERIES.blue },
                      { key: "escalated", label: "Escalated", color: SERIES.orange },
                      { key: "resolved", label: "Resolved", color: SERIES.aqua },
                    ]} />
                  </section>
                  <section className="rounded-xl border bg-white p-4">
                    <h3 className="font-semibold">Where these cases are now</h3>
                    <p className="mb-3 text-xs text-gray-500">Out of {s.cases} cases</p>
                    <StackBar title="Where these cases are now" parts={[
                      { key: "ai", label: "Answered by AI, no person needed", value: st.outcomes.ai_only, color: SERIES.blue },
                      { key: "waiting", label: "Waiting for a person", value: st.outcomes.waiting, color: SERIES.orange },
                      { key: "done", label: "Resolved by staff", value: st.outcomes.staff_resolved, color: SERIES.aqua },
                      { key: "with", label: "Being handled by staff", value: st.outcomes.with_staff, color: SERIES.yellow },
                    ]} />
                  </section>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                  <section className="rounded-xl border bg-white p-4 xl:col-span-2">
                    <h3 className="font-semibold">Issues and how often they need a person</h3>
                    <p className="mb-3 text-xs text-gray-500">High escalation rates show where the AI needs better knowledge articles.</p>
                    <SplitBars title="Cases by issue, split by escalation" partLabel="Escalated" restLabel="Handled by AI" partColor={SERIES.orange} restColor={SERIES.blue}
                      rows={issueRows(st.topics)} />
                  </section>
                  <section className="rounded-xl border bg-white p-4">
                    <h3 className="font-semibold">Customer mood</h3>
                    <p className="mb-3 text-xs text-gray-500">Sentiment the AI detected in the first message</p>
                    <LabelBars title="Customer sentiment" rows={SENTIMENTS.map((x) => ({ label: cap(x), value: st.sentiment[x] ?? 0, color: SENTIMENT_COLOR[x] }))} />
                    <h3 className="mb-2 mt-5 font-semibold">Priority</h3>
                    <LabelBars title="Cases by priority" rows={PRIORITIES.filter((x) => st.priority[x]).map((x) => ({ label: cap(x), value: st.priority[x], color: SERIES.blue }))} />
                  </section>
                </div>
              </>
            );
          })()}
        </section>

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
