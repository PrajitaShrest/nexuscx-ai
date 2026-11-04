import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import LiveRefresh from "@/components/LiveRefresh";
import FormIcon from "@/components/requests/FormIcon";
import { RequestPill } from "@/components/requests/Outcome";
import { can, getMe } from "@/lib/data/me";
import { getPack } from "@/lib/industry";
import { listRequestQueue, requestStats } from "@/lib/data/requests";
import { ago, dayTime } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Requests" };

const TABS = [
  ["todo", "To do", ["submitted", "in_review"]],
  ["waiting", "Waiting for changes", ["needs_info"]],
  ["collect", "Ready to collect", ["ready"]],
  ["done", "Finished", ["completed", "rejected", "cancelled"]],
  ["all", "All", []],
] as const;

// Forms people sent: ID cards, letters, permits, address changes. Each one is already
// checked, so staff only make the decision and mark it ready.
export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string; form?: string }> }) {
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Requests" needs="view_cases" />;
  const { tab = "todo", form = "" } = await searchParams;
  const [{ data: all, error }, stats, pack] = await Promise.all([listRequestQueue(), requestStats(30), getPack()]);
  const forms = [...new Map(all.map((r) => [r.type_key, r.request_types?.title ?? r.type_key])).entries()];
  const current = TABS.find((t) => t[0] === tab) ?? TABS[0];
  const shown = all.filter((r) => (current[2].length === 0 || (current[2] as readonly string[]).includes(r.status)) && (!form || r.type_key === form));
  const count = (s: readonly string[]) => all.filter((r) => s.length === 0 || s.includes(r.status)).length;
  // eslint-disable-next-line react-hooks/purity -- server component, rendered once per request
  const now = Date.now();
  const pct = stats && stats.finished > 0 ? Math.round((stats.first_time_right / stats.finished) * 100) : null;

  const tiles = [
    ["To do now", stats?.open ?? 0, stats?.overdue ? `${stats.overdue} past the target time` : "none overdue"],
    ["Ready to collect", stats?.to_collect ?? 0, "waiting at the desk"],
    ["Done first time", pct === null ? "—" : `${pct}%`, "no back-and-forth needed"],
    ["Typical time to ready", stats?.median_hours == null ? "—" : stats.median_hours < 1 ? `${Math.max(1, Math.round(stats.median_hours * 60))} min` : `${stats.median_hours} h`, "from sending to ready"],
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 md:flex-row">
      <Sidebar me={me} active="/requests" />
      <main className="min-w-0 flex-1 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Requests</h1>
            <p className="text-sm text-gray-500">Forms from {pack.people.toLowerCase()}. Every detail was checked when it was sent, so you only need to decide and mark it ready.</p>
          </div>
          <LiveRefresh name="request-queue" watch={[{ table: "service_requests", event: "*" }]} />
        </div>

        <div className="my-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map(([label, value, note]) => (
            <div key={label} className="rounded-lg border bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-gray-500">{note}</p>
            </div>
          ))}
        </div>
        <p className="-mt-2 mb-4 text-xs text-gray-500">Last 30 days.</p>

        {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
        <div className="rounded-lg border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 pt-3">
            <nav className="flex flex-wrap gap-4 text-sm" aria-label="Request status">
              {TABS.map(([id, label, s]) => (
                <Link key={id} href={`/requests?tab=${id}${form ? `&form=${form}` : ""}`}
                  className={`border-b-2 pb-2 ${tab === id ? "border-indigo-600 font-semibold text-indigo-700" : "border-transparent text-gray-500"}`}>
                  {label} <span className="text-xs text-gray-400">{count(s)}</span>
                </Link>
              ))}
            </nav>
            {forms.length > 1 && (
              <nav className="flex flex-wrap gap-1.5 pb-2 text-xs" aria-label="Form">
                <Link href={`/requests?tab=${tab}`} className={`rounded-full px-2.5 py-1 ${!form ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"}`}>All forms</Link>
                {forms.map(([k, t]) => <Link key={k} href={`/requests?tab=${tab}&form=${k}`} className={`rounded-full px-2.5 py-1 ${form === k ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"}`}>{t}</Link>)}
              </nav>
            )}
          </div>
          {shown.length === 0 ? <p className="p-6 text-sm text-gray-500">Nothing here right now.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>{["Request", pack.person, "Sent", "Target", "Handled by", "Status"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {shown.map((r) => {
                    const late = r.due_at && ["submitted", "in_review"].includes(r.status) && new Date(r.due_at).getTime() < now;
                    return (
                      <tr key={r.request_id} className="hover:bg-indigo-50/40">
                        <td className="px-4 py-3">
                          <Link href={`/requests/${r.request_id}`} className="flex items-center gap-3">
                            <FormIcon icon={r.request_types?.icon ?? ""} size="sm" />
                            <span><span className="block font-medium text-indigo-700">{r.request_types?.title}</span><span className="block text-xs text-gray-500">{r.request_number}</span></span>
                          </Link>
                        </td>
                        <td className="px-4 py-3"><span className="block">{r.customer?.user?.name}</span><span className="block text-xs text-gray-500">{r.customer?.student_number ?? r.customer?.user?.email}</span></td>
                        <td className="whitespace-nowrap px-4 py-3">{ago(r.created_at)}</td>
                        <td className={`whitespace-nowrap px-4 py-3 ${late ? "font-semibold text-red-700" : ""}`}>{r.due_at && ["submitted", "in_review"].includes(r.status) ? `${late ? "Overdue · " : ""}${dayTime(r.due_at)}` : "—"}</td>
                        <td className="px-4 py-3">{r.assignee?.name ?? <span className="text-gray-400">{r.request_types?.team_name}</span>}</td>
                        <td className="px-4 py-3"><RequestPill status={r.status} staff /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
