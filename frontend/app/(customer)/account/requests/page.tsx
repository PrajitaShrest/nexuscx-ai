import Link from "next/link";
import { PageHead } from "@/components/CustomerShell";
import { EmptyState } from "@/components/ShopUI";
import { ArrowRightIcon, ClockIcon } from "@/components/Icons";
import LiveRefresh from "@/components/LiveRefresh";
import FormIcon from "@/components/requests/FormIcon";
import { RequestPill } from "@/components/requests/Outcome";
import { getRequestForms, listMyRequests } from "@/lib/data/requests";
import { getMe } from "@/lib/data/me";
import { hoursText, isOpen } from "@/lib/forms";
import { ago, day } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Requests & forms" };

// Forms the person can fill in, and the requests they have sent.
export default async function MyRequestsPage() {
  const [me, { types }, requests] = await Promise.all([getMe(), getRequestForms(), listMyRequests()]);
  const open = requests.filter((r) => isOpen(r.status) || r.status === "ready");
  const past = requests.filter((r) => !open.includes(r));

  return (
    <>
      <PageHead title="Requests & forms" sub="Ask for things online in a couple of minutes. Your details are filled in for you and checked before sending." />

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
                    <span className="block font-semibold">{r.request_types?.title} <span className="font-normal text-muted">· {r.request_number}</span></span>
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
