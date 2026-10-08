import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import { getMe, can, ROLE_LABEL } from "@/lib/data/me";
import { getOverview, listTeams } from "@/lib/data/admin";
import ManagePerson from "./ManagePerson";

function when(at: string | null) {
  if (!at) return "Never";
  return new Date(at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!can(me, "manage_users")) return <NoAccess me={me} page="Users & Roles" needs="manage_users" />;
  const { id } = await params;
  const [{ data: p, error }, teams] = await Promise.all([getOverview(id), listTeams()]);

  return (
    <div className="flex min-h-screen bg-gray-50 text-ink">
      <Sidebar me={me} active="/users" />
      <main className="flex-1 space-y-6 p-6">
        <Link href="/users" className="text-sm text-indigo-600 hover:underline">← All people</Link>
        {!p ? (
          <p className="rounded-lg bg-red-50 p-4 text-bad">{error ?? "That person no longer exists."}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
                {p.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  {p.name}{p.is_self && <span className="ml-2 text-sm font-normal text-indigo-600">(you)</span>}
                </h1>
                <p className="text-muted">{p.username} · {p.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{ROLE_LABEL[p.role]}</span>
                  {p.extra_roles.map((r) => (
                    <span key={r} className="rounded-full border border-indigo-200 px-2.5 py-0.5 text-xs text-indigo-700">+ {ROLE_LABEL[r]}</span>
                  ))}
                  {p.status === "suspended" && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-bad">Suspended</span>}
                  {p.locked_seconds > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">Locked</span>}
                  {p.must_change_password && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">Must change password</span>}
                  {!p.has_login && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">No login yet</span>}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Last sign-in", when(p.last_sign_in_at)],
                ["Last active", when(p.last_active_at)],
                ["Account created", when(p.created_at)],
                ["Cases", String(p.case_count)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border bg-white px-4 py-3">
                  <p className="text-xs text-muted">{k}</p><p className="mt-1 font-semibold">{v}</p>
                </div>
              ))}
            </div>

            {p.is_self && (
              <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                This is your own account. To stop you locking yourself out, you can&apos;t suspend, delete or remove your own administrator role here.
              </p>
            )}

            <ManagePerson person={p} teams={teams} />

            <section className="rounded-xl border bg-white">
              <h2 className="border-b px-5 py-3 font-semibold">Recent activity</h2>
              {p.activity.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">Nothing recorded yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {p.activity.map((a, i) => (
                    <li key={i} className="flex flex-wrap gap-x-4 px-5 py-2.5">
                      <span className="w-40 text-muted">{when(a.at)}</span>
                      <span className="flex-1">{a.action.replace(/_/g, " ")} <span className="text-muted">by {a.actor}</span></span>
                      <span className={a.result === "success" ? "text-ok" : "text-bad"}>{a.result}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
