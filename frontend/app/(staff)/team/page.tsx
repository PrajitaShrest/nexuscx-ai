import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import FilterBar from "@/components/FilterBar";
import Avatar, { PRESENCE } from "@/components/Avatar";
import { can, getMe, ROLE_LABEL } from "@/lib/data/me";
import { getTeamStats } from "@/lib/data/ops";
import { PERIODS, readFilters } from "@/lib/data/stats";
import { ago } from "@/lib/format";

const wait = (m: number | null) => (m === null ? "—" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 6) / 10} h` : `${Math.round(m / 144) / 10} days`);

export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await getMe();
  if (!can(me, "view_analytics")) return <NoAccess me={me} page="Team Operations" needs="view_analytics" />;
  const f = readFilters(await searchParams);
  const { data, error } = await getTeamStats(f.days);
  const people = data?.people ?? [];
  const online = people.filter((p) => p.presence === "online").length;
  const capacity = people.filter((p) => p.presence !== "offline").reduce((a, p) => a + Math.max(0, p.max_active_cases - p.active_cases), 0);
  const teams = [...new Set(people.map((p) => p.team ?? "No team"))];

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/team" />
      <main className="min-w-0 flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Team Operations</h1>
            <p className="text-sm text-gray-500">Who is available, how full each person is, and how fast escalated customers get a person.</p>
          </div>
          <FilterBar filters={[{ name: "days", label: "Period", options: PERIODS.map((p) => [String(p), `Last ${p} days`] as [string, string]) }]} />
        </div>
        {error && <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{error} Migration 015 must be run in Supabase.</p>}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                ["Waiting for a person", data.queue.waiting, data.queue.waiting ? "text-red-600" : "", "/cases?status=escalated"],
                ["Longest wait now", wait(data.queue.oldest_wait_min), (data.queue.oldest_wait_min ?? 0) > 60 ? "text-red-600" : "", "/cases?status=escalated"],
                ["Past SLA (open)", data.queue.sla_breached, data.queue.sla_breached ? "text-amber-600" : "", "/cases?sla=risk"],
                ["High priority waiting", data.queue.unassigned_high, data.queue.unassigned_high ? "text-red-600" : "", "/cases?status=escalated&priority=high"],
                ["Staff online", `${online} / ${people.length}`, "", ""],
                ["Free capacity", `${capacity} cases`, capacity === 0 ? "text-red-600" : "", ""],
              ].map(([k, v, tone, href]) => {
                const body = <><p className="text-xs text-gray-500">{k}</p><p className={`mt-1 text-2xl font-semibold ${tone}`}>{v}</p></>;
                return href ? <Link key={k as string} href={href as string} className="rounded-xl border bg-white px-4 py-3 hover:border-indigo-300">{body}</Link>
                  : <div key={k as string} className="rounded-xl border bg-white px-4 py-3">{body}</div>;
              })}
            </div>

            {teams.map((t) => (
              <section key={t} className="rounded-xl border bg-white p-4">
                <h2 className="mb-3 font-semibold">{t}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-gray-500">
                      <tr>{["Person", "Workload now", `Taken (${f.days}d)`, "Resolved", "Avg pickup", "Replies", "Rating", "Last active"].map((h) => <th key={h} className="whitespace-nowrap pb-2 pr-4">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y tabular-nums">
                      {people.filter((p) => (p.team ?? "No team") === t).map((p) => {
                        const full = p.active_cases >= p.max_active_cases;
                        return (
                          <tr key={p.user_id}>
                            <td className="py-2.5 pr-4">
                              <span className="flex items-center gap-2.5">
                                <Avatar name={p.name} size={30} presence={p.presence} />
                                <span><span className="block font-medium">{p.name}</span><span className="block text-xs text-gray-500">{ROLE_LABEL[p.role] ?? p.role} · {PRESENCE[p.presence]?.label ?? p.presence}</span></span>
                              </span>
                            </td>
                            <td className="min-w-40 pr-4">
                              <span className="flex items-center gap-2">
                                <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"><span className={`block h-full rounded-full ${full ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (p.active_cases / Math.max(1, p.max_active_cases)) * 100)}%` }} /></span>
                                <span className={`text-xs ${full ? "font-semibold text-red-700" : "text-gray-600"}`}>{p.active_cases}/{p.max_active_cases}{full ? " full" : ""}</span>
                              </span>
                            </td>
                            <td className="pr-4">{p.taken}</td>
                            <td className="pr-4">{p.resolved}</td>
                            <td className="pr-4">{wait(p.pickup_min)}</td>
                            <td className="pr-4">{p.replies}</td>
                            <td className="pr-4">{p.rating !== null ? `${p.rating} ★` : "—"}</td>
                            <td className="whitespace-nowrap pr-4 text-gray-500">{p.last_active_at ? ago(p.last_active_at) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
            {people.length === 0 && <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">No support staff yet. Add people on the Users & Roles page.</p>}
            <p className="text-xs text-gray-400">Avg pickup = time from escalation until someone took the case. Replies = messages sent to customers in the period.</p>
          </>
        )}
      </main>
    </div>
  );
}
