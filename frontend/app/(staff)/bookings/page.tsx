import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import LiveRefresh from "@/components/LiveRefresh";
import BookingActions from "./BookingActions";
import { can, getMe } from "@/lib/data/me";
import { listStaffAppointments, slotText, type StaffAppointment } from "@/lib/data/appointments";
import { ago, dayTime } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bookings" };

const TARGET_MIN: Record<string, number> = { urgent: 15, today: 240 };

// Call-backs and booked times with students or customers (migration 031).
// Urgent call-backs (wellbeing, product safety) are always at the top.
export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Bookings" needs="view_cases" />;
  const { tab = "open" } = await searchParams;
  const all = await listStaffAppointments();
  // eslint-disable-next-line react-hooks/purity -- server component, rendered once per request
  const now = Date.now();
  const open = all.filter((a) => a.status === "requested" || a.status === "booked");
  const callbacks = open.filter((a) => a.kind === "callback").sort((a, b) => (a.urgency === "urgent" ? 0 : 1) - (b.urgency === "urgent" ? 0 : 1) || a.created_at.localeCompare(b.created_at));
  const bookings = open.filter((a) => a.kind === "booking").sort((a, b) => (a.slot_at ?? "").localeCompare(b.slot_at ?? ""));
  const past = all.filter((a) => !open.includes(a));
  const urgentWaiting = callbacks.filter((a) => a.urgency === "urgent").length;
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const todayCount = bookings.filter((a) => a.slot_at && new Date(a.slot_at).toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" }) === today).length;

  const who = (a: StaffAppointment) => (
    <div className="min-w-0">
      <p className="font-medium">{a.customer?.user?.name ?? "Someone"}{a.customer?.student_number ? <span className="ml-1 font-mono text-xs text-gray-500">{a.customer.student_number}</span> : null}</p>
      <p className="text-xs text-gray-500">{a.phone ?? a.customer?.user?.email}{a.cases ? <> · <Link href={`/cases/${a.case_id}`} className="text-indigo-700 hover:underline">{a.cases.case_number}</Link></> : null}</p>
      {a.note && <p className="mt-1 text-sm">“{a.note}”</p>}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900 md:flex-row">
      <Sidebar me={me} active="/bookings" />
      <main className="min-w-0 flex-1 space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Bookings</h1>
            <p className="text-sm text-gray-500">People who asked to talk to a person. Urgent call-backs come first: call within 15 minutes.</p>
          </div>
          <LiveRefresh name="bookings" watch={[{ table: "appointments", event: "*" }]} />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Urgent call-backs waiting", urgentWaiting, urgentWaiting ? "call now" : "none waiting"],
            ["Call-backs today", callbacks.length - urgentWaiting, "before 5pm"],
            ["Booked for today", todayCount, "phone, video or in person"],
            ["Coming up", bookings.length, "all booked times"],
          ].map(([label, value, note]) => (
            <div key={String(label)} className={`rounded-lg border px-4 py-3 ${label === "Urgent call-backs waiting" && urgentWaiting ? "border-rose-300 bg-rose-50" : "bg-white"}`}>
              <p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-semibold">{value}</p><p className="text-xs text-gray-500">{note}</p>
            </div>
          ))}
        </div>

        <nav className="flex gap-2 text-sm">
          {[["open", "To do"], ["past", "Finished"]].map(([k, label]) => (
            <Link key={k} href={`/bookings?tab=${k}`} className={`rounded-full px-3 py-1 font-medium ${tab === k ? "bg-indigo-600 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200"}`}>{label}</Link>
          ))}
        </nav>

        {tab !== "past" ? (
          <>
            <section className="rounded-xl border bg-white">
              <h2 className="border-b px-4 py-3 font-semibold">Call-backs</h2>
              {callbacks.length === 0 ? <p className="px-4 py-6 text-sm text-gray-500">No one is waiting for a call.</p> : (
                <ul className="divide-y">
                  {callbacks.map((a) => {
                    const waited = Math.round((now - new Date(a.created_at).getTime()) / 60000);
                    const late = waited > (TARGET_MIN[a.urgency] ?? 240);
                    return (
                      <li key={a.appointment_id} className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${a.urgency === "urgent" ? "bg-rose-50/60" : ""}`}>
                        <div className="flex gap-3">
                          <span className={`mt-0.5 rounded px-2 py-0.5 text-xs font-bold ${a.urgency === "urgent" ? "bg-rose-600 text-white" : "bg-amber-100 text-amber-800"}`}>{a.urgency === "urgent" ? "URGENT" : "Today"}</span>
                          {who(a)}
                        </div>
                        <div className="space-y-1 text-right">
                          <p className={`text-xs ${late ? "font-semibold text-red-600" : "text-gray-500"}`}>{a.team} · asked {ago(a.created_at)}{late ? " · past target" : ""}</p>
                          {a.handler && <p className="text-xs text-gray-500">Taken by {a.handler.name}</p>}
                          <BookingActions id={a.appointment_id} taken={!!a.handler} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section className="rounded-xl border bg-white">
              <h2 className="border-b px-4 py-3 font-semibold">Booked times</h2>
              {bookings.length === 0 ? <p className="px-4 py-6 text-sm text-gray-500">Nothing booked.</p> : (
                <ul className="divide-y">
                  {bookings.map((a) => (
                    <li key={a.appointment_id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                      <div className="flex gap-3">
                        <span className="mt-0.5 w-40 shrink-0 text-sm font-semibold">{a.slot_at ? slotText(a.slot_at) : "—"}</span>
                        {who(a)}
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-xs text-gray-500">{a.mode} · {a.team}</p>
                        {a.handler && <p className="text-xs text-gray-500">Taken by {a.handler.name}</p>}
                        <BookingActions id={a.appointment_id} taken={!!a.handler} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <section className="rounded-xl border bg-white">
            {past.length === 0 ? <p className="px-4 py-6 text-sm text-gray-500">Nothing finished yet.</p> : (
              <ul className="divide-y">
                {past.map((a) => (
                  <li key={a.appointment_id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
                    {who(a)}
                    <p className="text-xs text-gray-500">{a.kind === "callback" ? "Call-back" : a.mode} · {a.team} · {a.status} {a.done_at ? dayTime(a.done_at) : ""}{a.handler ? ` · ${a.handler.name}` : ""}{a.handled_note ? ` · ${a.handled_note}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
