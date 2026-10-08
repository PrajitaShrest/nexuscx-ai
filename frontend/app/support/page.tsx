import { redirect } from "next/navigation";
import CustomerHeader from "@/components/CustomerHeader";
import { ClockIcon, HeadsetIcon, ShieldIcon, SparkIcon, BookIcon } from "@/components/Icons";
import { getMe, isStaff } from "@/lib/data/me";
import { listCaseQueue } from "@/lib/data/cases";
import EnquiryForm from "./EnquiryForm";
import MyRequests, { type RequestCard } from "./MyRequests";

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-AU", { hour: "numeric", hour12: false, timeZone: "Australia/Sydney" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// Customer portal: chat with the AI assistant + track my requests.
export default async function SupportPage() {
  const me = await getMe();
  if (isStaff(me)) redirect("/conversations");
  const { data: myCases } = await listCaseQueue(); // RLS returns only this customer's cases
  const first = me.name.split(" ")[0];

  const items: RequestCard[] = myCases.map((c) => ({
    id: c.case_id, number: c.case_number, subject: c.subject ?? "Support request", intent: c.intent, status: c.status, ago: ago(c.created_at),
  }));
  const done = (s: string) => s === "resolved" || s === "closed";
  const stats = [
    { label: "Open", value: items.filter((c) => !done(c.status)).length, icon: <ClockIcon className="h-5 w-5" /> },
    { label: "With our team", value: items.filter((c) => ["escalated", "human_handling", "waiting"].includes(c.status)).length, icon: <HeadsetIcon className="h-5 w-5" /> },
    { label: "Resolved", value: items.filter((c) => done(c.status)).length, icon: <SparkIcon className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      <CustomerHeader me={me} />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* Welcome banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-6 text-white shadow-lg shadow-indigo-200 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-24 right-32 h-56 w-56 rounded-full bg-white/10" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-300" /> Support is online now
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{greeting()}, {first}!</h1>
              <p className="mt-2 max-w-md text-indigo-100">How can we help today? Our AI answers in seconds, and a real person steps in whenever you need one.</p>
            </div>
            <div className="flex gap-3">
              {stats.map((s) => (
                <div key={s.label} className="min-w-24 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm ring-1 ring-white/20">
                  <span className="text-indigo-100">{s.icon}</span>
                  <p className="mt-1 text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-indigo-100">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2"><EnquiryForm firstName={first} /></div>
          <aside className="min-w-0 space-y-6">
            <MyRequests items={items} />
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-bold">Why you can trust our answers</h2>
              <ul className="space-y-3 text-sm">
                {[
                  [<BookIcon key="b" className="h-4 w-4" />, "Answers come only from approved help articles, with the source shown."],
                  [<HeadsetIcon key="h" className="h-4 w-4" />, "Refunds, account changes and urgent issues always go to a person."],
                  [<ShieldIcon key="s" className="h-4 w-4" />, "Your details are private and every action is recorded."],
                ].map(([icon, text], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">{icon}</span>
                    <span className="text-muted">{text}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
