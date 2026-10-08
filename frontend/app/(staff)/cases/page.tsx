import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import { can } from "@/lib/data/me";
import { CATEGORY, STATUS, Pill } from "@/components/Badges";
import { getMe } from "@/lib/data/me";
import { listCaseQueue } from "@/lib/data/cases";

function sla(mins: number | null, status: string) {
  if (mins === null || status === "resolved" || status === "closed") return "—";
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function CasesPage() {
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Cases" needs="view_cases" />;
  const { data: cases, error } = await listCaseQueue();
  const escalated = cases.filter((c) => c.status === "escalated").length;
  const slaRisk = cases.filter((c) => c.sla_minutes_left !== null && c.sla_minutes_left < 60 && !["resolved", "closed"].includes(c.status)).length;

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/cases" />
      <main className="flex-1 p-6">
        <h1 className="text-xl font-semibold">Case Queue</h1>
        <p className="mb-4 text-sm text-gray-500">AI-powered customer service management</p>
        <div className="mb-6 flex gap-4">
          {[["Total", cases.length], ["Escalated", escalated], ["SLA Risk", slaRisk]].map(([k, v]) => (
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
                <tr key={c.case_id}>
                  <td className="px-4 py-3 font-medium">{c.case_number}</td>
                  <td className="px-4 py-3">{c.customer_name}</td>
                  <td className="max-w-xs truncate px-4 py-3">{c.subject}</td>
                  <td className="px-4 py-3"><Pill map={CATEGORY} value={c.intent} /></td>
                  <td className="px-4 py-3 capitalize">{c.priority}</td>
                  <td className="px-4 py-3 capitalize">{c.sentiment ?? "—"}</td>
                  <td className="px-4 py-3">{c.assigned_to ?? "—"}</td>
                  <td className={`px-4 py-3 ${c.sla_minutes_left !== null && c.sla_minutes_left < 60 ? "text-red-600" : ""}`}>{sla(c.sla_minutes_left, c.status)}</td>
                  <td className="px-4 py-3"><Pill map={STATUS} value={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
