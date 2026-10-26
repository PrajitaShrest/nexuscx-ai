import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import LiveRefresh from "@/components/LiveRefresh";
import NoAccess from "@/components/NoAccess";
import { can } from "@/lib/data/me";
import { CATEGORY, STATUS, Pill } from "@/components/Badges";
import { getMe } from "@/lib/data/me";
import { listCaseQueue } from "@/lib/data/cases";
import FilterBar from "@/components/FilterBar";
import { PRIORITIES, SENTIMENTS, TOPICS } from "@/lib/data/stats";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cases" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const SENTIMENT_STYLE: Record<string, string> = { angry: "text-red-700 font-medium", negative: "text-red-600", neutral: "text-gray-600", positive: "text-emerald-700" };

function sla(mins: number | null, status: string) {
  if (mins === null || status === "resolved" || status === "closed") return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function CasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Cases" needs="view_cases" />;
  const sp = await searchParams;
  const pick = <T extends string>(v: string | undefined, list: readonly T[]) => (v && (list as readonly string[]).includes(v) ? v : undefined);
  const { data: cases, error } = await listCaseQueue({
    q: sp.q, status: pick(sp.status, ["all", "open", "ai_handling", "escalated", "human_handling", "waiting", "resolved", "closed"]),
    intents: sp.topic && sp.topic in TOPICS ? TOPICS[sp.topic].intents : undefined,
    priority: pick(sp.priority, PRIORITIES), sentiment: pick(sp.sentiment, SENTIMENTS),
    assigned: pick(sp.assigned, ["me", "nobody"]), myName: me.name, sla: pick(sp.sla, ["risk"]),
  });
  const filtered = ["q", "status", "topic", "priority", "sentiment", "assigned", "sla"].some((k) => sp[k]);
  const escalated = cases.filter((c) => c.status === "escalated").length;
  const slaRisk = cases.filter((c) => c.sla_minutes_left !== null && c.sla_minutes_left < 60 && !["resolved", "closed"].includes(c.status)).length;

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/cases" />
      <main className="flex-1 p-6">
        <h1 className="flex items-center gap-3 text-xl font-semibold">Case Queue <LiveRefresh name="cases" watch={[{ table: "cases" }]} /></h1>
        <p className="mb-4 text-sm text-gray-500">AI-powered customer service management. Click a case to open it, chat with the customer and resolve it.</p>
        <div className="mb-4">
          <FilterBar search={{ name: "q", label: "Search", placeholder: "Case, customer or issue" }} filters={[
            { name: "status", label: "Status", options: [["", "Not closed"], ["open", "Open (not resolved)"], ["escalated", "Escalated"], ["ai_handling", "AI handling"], ["human_handling", "Human handling"], ["waiting", "Waiting for customer"], ["resolved", "Resolved"], ["closed", "Closed"], ["all", "All, including closed"]] },
            { name: "topic", label: "Issue", options: [["", "All issues"], ...Object.entries(TOPICS).map(([k, t]) => [k, t.label] as [string, string])] },
            { name: "priority", label: "Priority", options: [["", "All priorities"], ...PRIORITIES.map((p) => [p, cap(p)] as [string, string])] },
            { name: "sentiment", label: "Sentiment", options: [["", "All sentiment"], ...SENTIMENTS.map((x) => [x, cap(x)] as [string, string])] },
            { name: "assigned", label: "Assigned to", options: [["", "Anyone"], ["me", "Me"], ["nobody", "Nobody yet"]] },
            { name: "sla", label: "SLA", options: [["", "Any"], ["risk", "Due within 1 hour"]] },
          ]} />
        </div>
        <div className="mb-6 flex gap-4">
          {[[filtered ? "Matching" : "Total", cases.length], ["Escalated", escalated], ["SLA Risk", slaRisk]].map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-white px-5 py-3"><p className="text-xs text-gray-500">{k}</p><p className="text-2xl font-semibold">{v}</p></div>
          ))}
        </div>
        {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>{["Case ID", "Customer", "Issue", "Intent", "Priority", "Sentiment", "Assigned to", "SLA", "Status"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {cases.map((c) => (
                <tr key={c.case_id} className="hover:bg-indigo-50/40">
                  <td className="px-4 py-3 font-medium"><Link href={`/cases/${c.case_id}`} className="text-indigo-700 hover:underline">{c.case_number}</Link></td>
                  <td className="px-4 py-3">{c.customer_name}</td>
                  <td className="max-w-xs truncate px-4 py-3"><Link href={`/cases/${c.case_id}`} className="hover:text-indigo-700">{c.subject}</Link></td>
                  <td className="px-4 py-3"><Pill map={CATEGORY} value={c.intent} /></td>
                  <td className="px-4 py-3 capitalize">{c.priority}</td>
                  <td className={`px-4 py-3 capitalize ${SENTIMENT_STYLE[c.sentiment ?? ""] ?? ""}`}>{c.sentiment ?? "—"}</td>
                  <td className="px-4 py-3">{c.assigned_to ?? "—"}</td>
                  <td className={`px-4 py-3 ${c.sla_minutes_left !== null && c.sla_minutes_left < 60 ? "text-red-600" : ""}`}>{sla(c.sla_minutes_left, c.status)}</td>
                  <td className="px-4 py-3"><Pill map={STATUS} value={c.status} /></td>
                </tr>
              ))}
              {cases.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500">{filtered ? "No cases match these filters." : "No cases yet."}</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
