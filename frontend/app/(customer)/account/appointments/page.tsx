import Link from "next/link";
import { PageHead } from "@/components/CustomerShell";
import { EmptyState } from "@/components/ShopUI";
import { CalendarIcon, HeadsetIcon } from "@/components/Icons";
import LiveRefresh from "@/components/LiveRefresh";
import TalkToPerson from "@/components/talk/TalkToPerson";
import CancelAppointment from "@/components/talk/CancelAppointment";
import { icsLink } from "@/components/talk/ics";
import { getBookingOptions, listMyAppointments, slotText } from "@/lib/data/appointments";
import { getPack } from "@/lib/industry";
import { dayTime } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My appointments" };

const STATUS: Record<string, { label: string; style: string }> = {
  requested: { label: "Waiting for our call", style: "bg-amber-50 text-amber-800 ring-amber-200" },
  booked: { label: "Booked", style: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  done: { label: "Done", style: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  missed: { label: "We couldn't reach you", style: "bg-rose-50 text-rose-700 ring-rose-200" },
  cancelled: { label: "Cancelled", style: "bg-slate-100 text-slate-600 ring-slate-200" },
};

// Call-backs and booked times with a person (migration 031)
export default async function MyAppointmentsPage() {
  const [list, options, pack] = await Promise.all([listMyAppointments(), getBookingOptions(), getPack()]);
  return (
    <>
      <PageHead title="My appointments" sub="Talk to a real person: ask for a call back, or book a time that suits you." />
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <TalkToPerson caseId={null} flag={null} options={options} uni={!pack.shop} />
      </section>
      <section aria-labelledby="mine" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="mine" className="text-sm font-semibold uppercase tracking-wider text-muted">Your appointments</h2>
          <LiveRefresh name="my-appointments" watch={[{ table: "appointments", event: "*" }]} />
        </div>
        {list.length === 0 ? (
          <EmptyState icon={<CalendarIcon className="h-6 w-6" />} title="No appointments yet" text="When you ask for a call back or book a time, it shows here." />
        ) : (
          <ul className="space-y-3">
            {list.map((a) => {
              const s = STATUS[a.status] ?? STATUS.requested;
              const live = a.status === "requested" || a.status === "booked";
              return (
                <li key={a.appointment_id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.urgency === "urgent" ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"}`}>
                      {a.kind === "callback" ? <HeadsetIcon className="h-5 w-5" /> : <CalendarIcon className="h-5 w-5" />}
                    </span>
                    <div className="text-sm">
                      <p className="font-semibold">
                        {a.kind === "callback" ? `Call back from ${a.team}` : `${a.mode} with ${a.team}`}
                        {a.urgency === "urgent" && <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">Urgent</span>}
                      </p>
                      <p className="text-muted">
                        {a.kind === "booking" && a.slot_at ? slotText(a.slot_at) : `Asked ${dayTime(a.created_at)}`}
                        {a.phone ? ` · ${a.phone}` : ""}
                      </p>
                      {a.handled_note && a.status !== "requested" && <p className="mt-1">Note from our team: {a.handled_note}</p>}
                      {a.case_id && <Link href={`/account/chats/${a.case_id}`} className="mt-1 inline-block text-indigo-700 hover:underline">Open the chat</Link>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${s.style}`}>{s.label}</span>
                    {a.kind === "booking" && a.slot_at && a.status === "booked" && (
                      <a href={icsLink({ start: a.slot_at, title: `${a.mode} with ${a.team}`, note: pack.org })} download="appointment.ics" className="text-sm font-semibold text-indigo-700 hover:underline">Add to calendar</a>
                    )}
                    {live && <CancelAppointment id={a.appointment_id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
