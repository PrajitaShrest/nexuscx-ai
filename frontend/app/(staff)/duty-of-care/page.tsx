import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import FilterBar from "@/components/FilterBar";
import { LabelBars } from "@/components/charts/Charts";
import { SERIES } from "@/components/charts/palette";
import { CheckIcon, ShieldIcon } from "@/components/Icons";
import { can, getMe } from "@/lib/data/me";
import { getCareReport } from "@/lib/data/ops";
import { getPack } from "@/lib/industry";
import { FLAG_LABEL } from "@/lib/care";
import { dayTime } from "@/lib/format";
import PrintButton from "./PrintButton";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Duty of care" };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const mins = (m: number | null) => (m === null || m === undefined ? "—" : m < 60 ? `${Math.round(m)} min` : `${Math.round(m / 6) / 10} h`);

function Stat({ label, value, note, good }: { label: string; value: React.ReactNode; note?: string; good?: boolean }) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3 print:break-inside-avoid">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${good ? "text-emerald-700" : ""}`}>{value}</p>
      {note && <p className="text-xs text-gray-500">{note}</p>}
    </div>
  );
}

// Duty-of-care report: proof for managers and regulators that every sensitive
// case went to a person, how fast, and that every step was recorded.
export default async function DutyOfCarePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const me = await getMe();
  if (!can(me, "view_analytics")) return <NoAccess me={me} page="Duty of care" needs="view_analytics" />;
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const [{ data: r, error }, pack] = await Promise.all([getCareReport(days), getPack()]);
  const people = pack.people.toLowerCase();

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 text-gray-900 print:bg-white">
      <div className="print:hidden"><Sidebar me={me} active="/duty-of-care" /></div>
      <main className="min-w-0 flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Duty-of-care report</h1>
            <p className="text-sm text-gray-500">
              {pack.org} · last {days} days{r ? ` · made ${dayTime(r.generated_at)}` : ""}. Proof that sensitive cases always reached a person, and how fast.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <FilterBar filters={[{ name: "days", label: "Period", options: [7, 30, 90].map((d) => [String(d), `Last ${d} days`] as [string, string]) }]} />
            <PrintButton />
            <a href={`/duty-of-care/export?days=${days}`} className="rounded-lg border bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Download CSV</a>
          </div>
        </div>
        {error && <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{error} Migration 019 must be run in Supabase.</p>}

        {r && (
          <>
            {/* The headline promise */}
            <section className={`flex flex-wrap items-center gap-4 rounded-2xl p-5 ${r.sensitive_ai_only === 0 ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                {r.sensitive_ai_only === 0 ? <CheckIcon className="h-7 w-7" /> : <ShieldIcon className="h-7 w-7" />}
              </span>
              <div>
                <p className="text-2xl font-bold">{r.sensitive_ai_only === 0 ? `All ${r.sensitive} sensitive cases went to a person` : `${r.sensitive_ai_only} sensitive case(s) were answered by AI alone`}</p>
                <p className="text-sm text-white/85">
                  Wellbeing, personal visa questions, special consideration, refunds and other sensitive requests are never answered by the AI alone. These are hard stops.
                </p>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Stat label="All cases" value={r.cases} note={`${r.ai_answered} answered by AI · ${r.to_person} by people`} />
              <Stat label="Sensitive cases" value={r.sensitive} note="always sent to a person" />
              <Stat label="Wellbeing cases picked up in" value={mins(r.wellbeing.median_pickup_min)} note={`median · ${r.wellbeing.cases} case${r.wellbeing.cases === 1 ? "" : "s"}, ${r.wellbeing.urgent} urgent`} good={r.wellbeing.cases > 0} />
              <Stat label="Picked up within target" value={`${pct(r.within_target, r.picked_up)}%`} note={`${r.within_target} of ${r.picked_up} · median ${mins(r.median_pickup_min)}`} good={pct(r.within_target, r.picked_up) >= 90} />
              <Stat label="Waiting for a person now" value={r.waiting_now} note={r.wellbeing.waiting_now ? `${r.wellbeing.waiting_now} wellbeing` : "no wellbeing case waiting"} />
              <Stat label="Steps recorded" value={r.audit_entries} note="in the audit log" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <section className="rounded-xl border bg-white p-4 print:break-inside-avoid">
                <h2 className="font-semibold">Why cases were sensitive</h2>
                <p className="mb-3 text-xs text-gray-500">Each one went to a person</p>
                {Object.keys(r.by_flag).length === 0 ? <p className="text-sm text-gray-500">No sensitive cases in this period.</p> : (
                  <LabelBars title="Sensitive cases" wideLabels rows={Object.entries(r.by_flag).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: FLAG_LABEL[k] ?? k, value: v, color: SERIES.orange }))} />
                )}
              </section>
              <section className="rounded-xl border bg-white p-4 print:break-inside-avoid xl:col-span-2">
                <h2 className="font-semibold">Other protections</h2>
                <ul className="mt-3 space-y-3 text-sm">
                  {[
                    [`${r.other_languages} message${r.other_languages === 1 ? "" : "s"} in other languages`, `${r.other_languages_to_person} passed to a person who can help, instead of a machine-translated answer.`],
                    [`${r.injections_blocked} attempt${r.injections_blocked === 1 ? "" : "s"} to trick the AI`, "Blocked and sent to a person for review."],
                    ["Only approved answers", "The AI only answers from articles a second person approved, and shows the source."],
                    [`Every decision recorded (${r.audit_entries} steps)`, "Who or what acted, when, and why. Entries cannot be edited or deleted."],
                  ].map(([t, d]) => (
                    <li key={t} className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckIcon className="h-3.5 w-3.5" /></span>
                      <span><strong className="font-semibold">{t}.</strong> <span className="text-gray-600">{d}</span></span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="rounded-xl border bg-white p-4">
              <h2 className="font-semibold">Sensitive cases ({r.list.length})</h2>
              <p className="mb-3 text-xs text-gray-500">Every sensitive case from {people} in this period, and how fast a person picked it up.</p>
              {r.list.length === 0 ? <p className="text-sm text-gray-500">None in this period.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-gray-500">
                      <tr>{["Case", "Reason", "Priority", "Went to a person", "Picked up after", "Target", "Status"].map((h) => <th key={h} className="whitespace-nowrap py-2 pr-4">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {r.list.map((c) => {
                        const late = c.pickup_min !== null && c.target_min !== null && c.pickup_min > c.target_min;
                        return (
                          <tr key={c.case_id}>
                            <td className="whitespace-nowrap py-2 pr-4"><Link href={`/cases/${c.case_id}`} className="text-indigo-700 hover:underline print:text-gray-900">{c.case_number}</Link></td>
                            <td className="py-2 pr-4">{FLAG_LABEL[c.flag] ?? c.flag}</td>
                            <td className="py-2 pr-4 capitalize">{c.priority}</td>
                            <td className="py-2 pr-4">{c.to_person ? <span className="text-emerald-700">Yes</span> : <span className="font-semibold text-red-700">No</span>}</td>
                            <td className={`whitespace-nowrap py-2 pr-4 ${late ? "font-semibold text-amber-700" : ""}`}>{c.pickup_min === null ? "Not yet" : mins(c.pickup_min)}</td>
                            <td className="whitespace-nowrap py-2 pr-4 text-gray-500">{mins(c.target_min)}</td>
                            <td className="py-2 pr-4 capitalize">{c.status.replace(/_/g, " ")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <p className="text-xs text-gray-500">Generated by NexusCX from the case records and the audit log. Times are from when the case went to a person to when a staff member took it or first replied.</p>
          </>
        )}
      </main>
    </div>
  );
}
