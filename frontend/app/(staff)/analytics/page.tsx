import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import FilterBar from "@/components/FilterBar";
import { Columns, LabelBars, TrendChart } from "@/components/charts/Charts";
import { SERIES } from "@/components/charts/palette";
import { can, getMe } from "@/lib/data/me";
import { getBreakdowns } from "@/lib/data/ops";
import { getCaseStats, PERIODS, readFilters } from "@/lib/data/stats";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Analytics" };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const HOURS = Array.from({ length: 24 }, (_, h) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`));
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SECURITY: Record<string, string> = { prompt_injection: "Prompt injection blocked", pii_redaction: "Personal data hidden", unauthorised_action: "Restricted action blocked", high_risk_escalation: "High-risk escalation" };

function Card({ title, sub, children, wide }: { title: string; sub?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`rounded-xl border bg-white p-4 ${wide ? "xl:col-span-2" : ""}`}>
      <h2 className="font-semibold">{title}</h2>
      {sub && <p className="mb-3 text-xs text-gray-500">{sub}</p>}
      {children}
    </section>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await getMe();
  if (!can(me, "view_analytics")) return <NoAccess me={me} page="Analytics" needs="view_analytics" />;
  const f = readFilters(await searchParams);
  const [{ data: st, error: e1 }, { data: b, error: e2 }] = await Promise.all([getCaseStats({ ...f, topic: "", sentiment: "", priority: "" }), getBreakdowns(f.days)]);
  const ratings = b ? [5, 4, 3, 2, 1].map((s) => ({ label: `${s} star${s > 1 ? "s" : ""}`, value: b.ratings[String(s)] ?? 0, color: s >= 4 ? SERIES.blue : s === 3 ? "#cfcdc6" : "#ee9a8f" })) : [];
  const rated = ratings.reduce((a, r) => a + r.value, 0);
  const happy = ratings.slice(0, 2).reduce((a, r) => a + r.value, 0);

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/analytics" />
      <main className="min-w-0 flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Analytics</h1>
            <p className="text-sm text-gray-500">How customers use the service, why cases need people, and what the AI relies on.</p>
          </div>
          <FilterBar filters={[{ name: "days", label: "Period", options: PERIODS.map((p) => [String(p), `Last ${p} days`] as [string, string]) }]} />
        </div>
        {(e1 || e2) && <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{e1 ?? e2} Migrations 014 and 015 must be run in Supabase.</p>}
        {st && b && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[["Cases", st.summary.cases], ["Handled by AI only", `${pct(st.summary.ai_only, st.summary.cases)}%`], ["Customer satisfaction", rated ? `${pct(happy, rated)}%` : "—"], ["Security events", Object.values(b.security).reduce((a, n) => a + n, 0)]].map(([k, v]) => (
                <div key={k} className="rounded-xl border bg-white px-4 py-3"><p className="text-xs text-gray-500">{k}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Card wide title="Cases per day" sub="New, escalated and resolved">
                <TrendChart title="Cases per day" data={st.daily} series={[
                  { key: "new", label: "New", color: SERIES.blue }, { key: "escalated", label: "Escalated", color: SERIES.orange }, { key: "resolved", label: "Resolved", color: SERIES.aqua },
                ]} />
              </Card>
              <Card title="Why cases went to a person" sub="The escalation rule that matched">
                {b.escalation_reasons.length ? <LabelBars title="Escalation reasons" rows={b.escalation_reasons.map((r) => ({ label: r.reason, value: r.n, color: SERIES.orange }))} wideLabels /> : <p className="text-sm text-gray-500">No escalations in this period.</p>}
              </Card>
              <Card wide title="Busiest hours" sub="New cases by hour of day, in the platform time zone. Use it to plan staff shifts.">
                <Columns title="Cases by hour of day" values={b.hours} labels={HOURS} color={SERIES.blue} labelEvery={3} />
              </Card>
              <Card title="Busiest days">
                <Columns title="Cases by day of week" values={b.weekdays} labels={DAYS} color={SERIES.blue} />
              </Card>
              <Card title="Customer ratings" sub={`${rated} ratings · ${rated ? pct(happy, rated) : 0}% gave 4 or 5 stars`}>
                <LabelBars title="Customer ratings" rows={ratings} />
              </Card>
              <Card title="Most used knowledge articles" sub="Articles the AI answered from">
                {b.top_articles.length ? <LabelBars title="Most used articles" rows={b.top_articles.map((a) => ({ label: a.title, value: a.n, color: SERIES.aqua }))} wideLabels /> : <p className="text-sm text-gray-500">No AI answers used an article in this period.</p>}
              </Card>
              <Card title="Safety" sub="What the safety checks caught">
                <ul className="space-y-2 text-sm">
                  {Object.entries(SECURITY).map(([k, l]) => (
                    <li key={k} className="flex justify-between"><span className="text-gray-700">{l}</span><span className="font-semibold tabular-nums">{b.security[k] ?? 0}</span></li>
                  ))}
                </ul>
              </Card>
              <Card wide title="AI agents in this period">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-gray-500"><tr>{["Agent", "Cases", "Answered alone", "Escalated", "Avg confidence", "Status"].map((h) => <th key={h} className="pb-2 pr-3">{h}</th>)}</tr></thead>
                    <tbody className="divide-y tabular-nums">
                      {b.agents.map((a) => (
                        <tr key={a.name}>
                          <td className="py-2 pr-3"><p className="font-medium">{a.name}</p><p className="text-xs text-gray-500">{a.department ?? "General"}</p></td>
                          <td className="pr-3">{a.requests}</td>
                          <td className="pr-3">{a.requests ? `${pct(a.ai_only, a.requests)}%` : "—"}</td>
                          <td className="pr-3">{a.requests ? `${pct(a.escalated, a.requests)}%` : "—"}</td>
                          <td className="pr-3">{a.confidence !== null ? `${a.confidence}%` : "—"}</td>
                          <td className="pr-3">{a.status === "active" ? "Active" : "Paused"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
