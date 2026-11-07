import Link from "next/link";
import { PageHead } from "@/components/CustomerShell";
import { EmptyState } from "@/components/ShopUI";
import { ArrowRightIcon, ClockIcon } from "@/components/Icons";
import LiveRefresh from "@/components/LiveRefresh";
import FormIcon from "@/components/requests/FormIcon";
import { RequestPill } from "@/components/requests/Outcome";
import { getRequestForms, listMyRequests } from "@/lib/data/requests";
import { getMe } from "@/lib/data/me";
import { unreadLinks } from "@/lib/data/workspace";
import { CheckIcon } from "@/components/Icons";
import { hoursText, isOpen } from "@/lib/forms";
import { ago, day } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Requests & forms" };

// Forms the person can fill in, and the requests they have sent.
export default async function MyRequestsPage() {
  const [me, { types }, requests, newLinks] = await Promise.all([getMe(), getRequestForms(), listMyRequests(), unreadLinks("/account/requests/")]);
  // Requests with an update the person has not opened yet
  const fresh = new Set(newLinks.map((l) => l.split("/").pop()));
  const updates = requests.filter((r) => fresh.has(r.request_id));
  const verb = (status: string, type: string) =>
    status === "rejected" ? (type === "special_consideration" ? "Not approved" : "Not completed")
      : type === "special_consideration" && ["ready", "completed"].includes(status) ? "Approved"
      : status === "ready" ? "Ready to collect" : status === "completed" ? "Ready" : status === "needs_info" ? "Needs your changes" : "Updated";
  const open = requests.filter((r) => isOpen(r.status) || r.status === "ready");
  const past = requests.filter((r) => !open.includes(r));

  return (
    <>
      <PageHead title="Requests & forms" sub="Ask for things online in a couple of minutes. Your details are filled in for you and checked before sending." />

      {updates.length > 0 && (
        <section aria-labelledby="updates" className="space-y-3">
          <h2 id="updates" className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Updates for you</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {updates.map((r) => {
              const bad = r.status === "rejected" || r.status === "needs_info";
              return (
                <Link key={r.request_id} href={`/account/requests/${r.request_id}`}
                  className={`flex items-center gap-4 rounded-2xl p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${bad ? "bg-amber-50 ring-1 ring-amber-200" : "bg-emerald-50 ring-1 ring-emerald-200"}`}>
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${bad ? "bg-amber-500" : "bg-emerald-600"}`}>
                    {bad ? <span className="text-lg font-bold">!</span> : <CheckIcon className="h-6 w-6" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{verb(r.status, r.type_key)}: {r.request_types?.title}</span>
                    <span className="block text-sm text-muted">{r.request_number} · {ago(r.updated_at)}</span>
                  </span>
                  <span className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-slate-200">Open</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="forms" className="space-y-3">
        <h2 id="forms" className="text-sm font-semibold uppercase tracking-wider text-muted">Start a request</h2>
        {types.length === 0 ? <p className="text-sm text-muted">There are no forms yet.</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {types.map((t) => (
              <Link key={t.type_key} href={`/account/requests/new?type=${t.type_key}`}
                className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
                <div className="flex items-center gap-3"><FormIcon icon={t.icon} /><span className="font-semibold">{t.title}</span></div>
                <p className="flex-1 text-sm text-muted">{t.summary}</p>
                <p className="flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" /> Usually {hoursText(t.sla_hours)}</span>
                  <ArrowRightIcon className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="mine" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="mine" className="text-sm font-semibold uppercase tracking-wider text-muted">My requests</h2>
          <LiveRefresh name={`my-requests-${me.user_id}`} watch={[{ table: "service_requests", event: "UPDATE" }]} />
        </div>
        {requests.length === 0 ? (
          <EmptyState icon={<ClockIcon className="h-6 w-6" />} title="No requests yet" text="When you send a form, you can follow it here and see when it is ready." />
        ) : (
          <ul className="space-y-2">
            {[...open, ...past].map((r) => (
              <li key={r.request_id}>
                <Link href={`/account/requests/${r.request_id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300">
                  <FormIcon icon={r.request_types?.icon ?? ""} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{r.request_types?.title} <span className="font-normal text-muted">· {r.request_number}</span>
                      {fresh.has(r.request_id) && <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">New</span>}</span>
                    <span className="block text-xs text-muted">Sent {day(r.created_at)} · updated {ago(r.updated_at)}</span>
                  </span>
                  <RequestPill status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
