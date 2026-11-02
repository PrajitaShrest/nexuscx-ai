import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import AdminForm from "@/components/AdminForm";
import { field } from "@/components/admin-ui";
import { LabelBars } from "@/components/charts/Charts";
import { SERIES } from "@/components/charts/palette";
import { ShieldIcon } from "@/components/Icons";
import { can, getMe } from "@/lib/data/me";
import { listAgents, listSettings, simulateRules } from "@/lib/data/ops";
import { getPack } from "@/lib/industry";
import { applySimulation } from "../admin-actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Test before you switch" };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Outcome({ title, ai, person, total, tone }: { title: string; ai: number; person: number; total: number; tone: "now" | "new" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "new" ? "border-indigo-300 bg-indigo-50/50" : "bg-white"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <div className="mt-2 flex items-end gap-6">
        <div><p className="text-3xl font-bold text-indigo-700">{ai}</p><p className="text-xs text-gray-500">answered by AI ({pct(ai, total)}%)</p></div>
        <div><p className="text-3xl font-bold text-amber-700">{person}</p><p className="text-xs text-gray-500">sent to a person ({pct(person, total)}%)</p></div>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-amber-200" aria-hidden>
        <span className="bg-indigo-500" style={{ width: `${pct(ai, total)}%` }} />
      </div>
    </div>
  );
}

// "Test before you switch": replay real questions from the last days with
// proposed settings, before saving them. Nothing changes until "Apply".
export default async function SimulatorPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await getMe();
  if (!can(me, "configure_ai") && !can(me, "view_analytics")) return <NoAccess me={me} page="Test before you switch" needs="configure_ai" />;
  const sp = await searchParams;
  const [{ settings }, { data: agents }, pack] = await Promise.all([listSettings(), listAgents(), getPack()]);
  const cur = (k: string) => settings.find((s) => s.setting_key === k)?.value;
  const nowThreshold = Number(cur("confidence_threshold") ?? 0.7);
  const nowAngry = cur("auto_escalate_angry") !== false;
  const nowHigh = cur("auto_escalate_high_risk") !== false;
  const specialists = agents.filter((a) => a.type === "specialist" && a.status === "active");

  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const threshold = sp.threshold ? Math.min(0.95, Math.max(0.3, Number(sp.threshold))) : nowThreshold;
  const angry = sp.angry ? sp.angry === "on" : nowAngry;
  const high = sp.high ? sp.high === "on" : nowHigh;
  const paused = specialists.some((a) => a.agent_id === sp.pause) ? sp.pause! : "";
  const ran = sp.run === "1";
  const sim = ran ? await simulateRules({ days, threshold, angry, highRisk: high, paused: paused || null }) : null;
  const s = sim?.data;
  const diff = s ? s.proposed.person - s.now.person : 0;
  const pausedName = specialists.find((a) => a.agent_id === paused)?.name;

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/simulator" />
      <main className="min-w-0 flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-xl font-semibold">Test before you switch</h1>
          <p className="text-sm text-gray-500">
            Try new AI settings on real {pack.people.toLowerCase()}&apos; questions from the last {days} days, using today&apos;s approved articles.
            You see exactly what would change <strong>before</strong> anything goes live.
          </p>
        </div>

        <form method="get" className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-2 xl:grid-cols-5">
          <input type="hidden" name="run" value="1" />
          <label className="text-sm">
            <span className="mb-1 block font-medium">Replay questions from</span>
            <select name="days" defaultValue={String(days)} className={`${field} w-full`}>
              {[7, 30, 90].map((d) => <option key={d} value={d}>Last {d} days</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Confidence threshold <span className="font-normal text-gray-500">(now {nowThreshold.toFixed(2)})</span></span>
            <input name="threshold" type="number" min={0.3} max={0.95} step={0.05} defaultValue={threshold.toFixed(2)} className={`${field} w-full`} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Angry {pack.people.toLowerCase()} go to a person</span>
            <select name="angry" defaultValue={angry ? "on" : "off"} className={`${field} w-full`}>
              <option value="on">Yes{nowAngry ? " (now)" : ""}</option><option value="off">No{!nowAngry ? " (now)" : ""}</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">High-risk cases go to a person</span>
            <select name="high" defaultValue={high ? "on" : "off"} className={`${field} w-full`}>
              <option value="on">Yes{nowHigh ? " (now)" : ""}</option><option value="off">No{!nowHigh ? " (now)" : ""}</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Pause an agent</span>
            <select name="pause" defaultValue={paused} className={`${field} w-full`}>
              <option value="">No agent paused</option>
              {specialists.map((a) => <option key={a.agent_id} value={a.agent_id}>{a.name}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-3 md:col-span-2 xl:col-span-5">
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Run the test</button>
            <Link href="/simulator" className="text-sm text-gray-600 hover:underline">Reset</Link>
            <span className="text-xs text-gray-500">Running a test changes nothing.</span>
          </div>
        </form>

        {sim?.error && <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{sim.error} Migration 019 must be run in Supabase.</p>}
        {!ran && (
          <p className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-gray-500">
            Change a setting above and press <strong>Run the test</strong>. Tip: try a confidence of 0.85, or pause an agent.
          </p>
        )}

        {s && (
          <>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <Outcome title="With today's settings" ai={s.now.ai} person={s.now.person} total={s.total} tone="now" />
              <span className="text-center text-2xl text-gray-400" aria-hidden>→</span>
              <Outcome title={`With your changes${pausedName ? ` (${pausedName} paused)` : ""}`} ai={s.proposed.ai} person={s.proposed.person} total={s.total} tone="new" />
            </div>

            <p className={`rounded-xl p-4 text-sm font-medium ${diff > 0 ? "bg-amber-50 text-amber-900" : diff < 0 ? "bg-sky-50 text-sky-900" : "bg-emerald-50 text-emerald-900"}`}>
              {diff === 0 && s.changed.length === 0
                ? `No difference: all ${s.total} questions would be handled the same way.`
                : diff > 0
                  ? `${diff} more question${diff === 1 ? "" : "s"} would go to a person, and the AI would answer ${diff} fewer. Safer, but more work for staff.`
                  : diff < 0
                    ? `The AI would answer ${-diff} more question${diff === -1 ? "" : "s"} by itself. Check the list below before you apply this.`
                    : `${s.changed.length} question${s.changed.length === 1 ? "" : "s"} would go to a person for a different reason.`}
            </p>

            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
              <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <p><strong>Hard stops are never affected.</strong> {s.hard_stops} wellbeing or personal visa question{s.hard_stops === 1 ? "" : "s"} went to a person in both versions. No setting can switch this off.</p>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <section className="rounded-xl border bg-white p-4">
                <h2 className="font-semibold">Why questions would go to a person</h2>
                <p className="mb-3 text-xs text-gray-500">With your changes</p>
                {Object.keys(s.reasons).length === 0 ? <p className="text-sm text-gray-500">None.</p> : (
                  <LabelBars title="Reasons" wideLabels rows={Object.entries(s.reasons).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: SERIES.orange }))} />
                )}
              </section>
              <section className="rounded-xl border bg-white p-4 xl:col-span-2">
                <h2 className="font-semibold">Questions that would be handled differently ({s.changed.length})</h2>
                <p className="mb-3 text-xs text-gray-500">Real questions, replayed. Up to 40 shown.</p>
                {s.changed.length === 0 ? <p className="text-sm text-gray-500">None.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-gray-500"><tr><th className="py-2 pr-3">Case</th><th className="py-2 pr-3">Question</th><th className="py-2 pr-3">Today</th><th className="py-2">With your changes</th></tr></thead>
                      <tbody className="divide-y">
                        {s.changed.map((c) => (
                          <tr key={c.case_number}>
                            <td className="whitespace-nowrap py-2 pr-3 text-gray-500">{c.case_number}</td>
                            <td className="py-2 pr-3">{c.question}</td>
                            <td className="whitespace-nowrap py-2 pr-3">{c.before}</td>
                            <td className={`whitespace-nowrap py-2 font-medium ${c.to_person ? "text-amber-700" : "text-indigo-700"}`}>{c.after}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            {can(me, "configure_ai") && (
              <section className="rounded-xl border bg-white p-4">
                <h2 className="font-semibold">Happy with this?</h2>
                <p className="text-xs text-gray-500">
                  Apply saves the confidence and escalation settings for new messages (and records it in the audit log).
                  {pausedName ? ` To pause ${pausedName}, use the AI Agents page.` : ""}
                </p>
                <AdminForm action={applySimulation} button="Apply these settings" className="mt-2">
                  <input type="hidden" name="threshold" value={threshold} />
                  <input type="hidden" name="angry" value={angry ? "on" : "off"} />
                  <input type="hidden" name="high" value={high ? "on" : "off"} />
                </AdminForm>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
