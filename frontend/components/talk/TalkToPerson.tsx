"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { askCallback, bookTime, type TalkState } from "@/app/(customer)/account/appointments/actions";
import type { BookingOptions } from "@/lib/data/appointments";
import { btnPrimary } from "@/components/ShopUI";
import { CalendarIcon, CheckIcon, HeadsetIcon } from "@/components/Icons";
import { icsLink } from "./ics";

const SYD = "Australia/Sydney";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: SYD });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: SYD });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: SYD });
const field = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

// "Talk to a person", under a chat. The duty-of-care rule is built in:
// a wellbeing or product-safety chat only gets "Call me now" (urgent), never a booking form.
export default function TalkToPerson({ caseId, flag, options, uni }: {
  caseId: string | null; flag: string | null; options: BookingOptions | null; uni: boolean;
}) {
  const urgent = flag === "wellbeing" || flag === "product_safety";
  const [open, setOpen] = useState(urgent);
  const [tab, setTab] = useState<"call" | "book">("call");
  const [cb, cbAction, cbPending] = useActionState<TalkState, FormData>(askCallback, {});
  const [bk, bkAction, bkPending] = useActionState<TalkState, FormData>(bookTime, {});
  const teams = options?.teams ?? [];
  const [team, setTeam] = useState(teams[0] ?? "");
  const [mode, setMode] = useState("Phone call");
  const free = useMemo(() => (options?.slots ?? []).filter((s) => !(options?.taken[team] ?? []).some((t) => +new Date(t) === +new Date(s))), [options, team]);
  const days = useMemo(() => [...new Map(free.map((s) => [dayKey(s), dayLabel(s)])).entries()], [free]);
  const [day, setDay] = useState("");
  const shownDay = days.some(([k]) => k === day) ? day : days[0]?.[0] ?? "";
  const [slot, setSlot] = useState("");

  if (cb.done) {
    return (
      <div className="border-t bg-emerald-50 px-5 py-4 text-sm text-emerald-950">
        <p className="flex items-center gap-2 font-semibold"><CheckIcon className="h-4 w-4" /> {cb.urgent ? "A person will call you as soon as possible, usually within 15 minutes." : "A person will call you back today (Monday to Friday, 9am to 5pm)."}</p>
        {cb.urgent && flag === "wellbeing" && <p className="mt-1">If you are in danger right now, call <strong>000</strong>. Lifeline is there any time on <strong>13 11 14</strong>.</p>}
        <Link href="/account/appointments" className="mt-1 inline-block font-semibold text-indigo-700 hover:underline">See My appointments →</Link>
      </div>
    );
  }
  if (bk.done && bk.when) {
    return (
      <div className="border-t bg-emerald-50 px-5 py-4 text-sm text-emerald-950">
        <p className="flex items-center gap-2 font-semibold"><CheckIcon className="h-4 w-4" /> Booked: {mode.toLowerCase()} with {team}, {dayLabel(bk.when)} at {timeLabel(bk.when)}.</p>
        <p className="mt-2 flex flex-wrap gap-3">
          <a href={icsLink({ start: bk.when, title: `${mode} with ${team}`, note: uni ? "Northbridge University (demo)" : "NexusCX Store (demo)" })} download="appointment.ics" className="font-semibold text-indigo-700 hover:underline">Add to my calendar</a>
          <Link href="/account/appointments" className="font-semibold text-indigo-700 hover:underline">See My appointments →</Link>
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-5 py-3 text-sm">
        <span className="text-muted">Not getting the help you need?</span>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 font-semibold text-indigo-700 hover:bg-indigo-50">
          <HeadsetIcon className="h-4 w-4" /> Talk to a person
        </button>
      </div>
    );
  }

  const callForm = (
    <form action={cbAction} className="space-y-3">
      <input type="hidden" name="case_id" value={caseId ?? ""} />
      <label className="block text-sm font-medium">Your phone number
        <input name="phone" type="tel" required defaultValue={options?.phone ?? ""} placeholder="0412 345 678" className={`${field} mt-1`} autoComplete="tel" />
      </label>
      {!urgent && (
        <label className="block text-sm font-medium">What would you like to talk about? (optional)
          <textarea name="note" rows={2} maxLength={500} className={`${field} mt-1`} />
        </label>
      )}
      <button disabled={cbPending} className={btnPrimary}><HeadsetIcon className="h-4 w-4" /> {cbPending ? "Sending…" : urgent ? "Call me now" : "Call me back today"}</button>
      {cb.error && <p role="alert" className="text-sm text-bad">{cb.error}</p>}
    </form>
  );

  return (
    <div className={`border-t px-5 py-4 ${urgent ? "bg-rose-50" : "bg-slate-50"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{urgent ? "Talk to a person now" : "Talk to a person"}</p>
          <p className="text-sm text-muted">
            {urgent
              ? flag === "wellbeing"
                ? "You don't need to book. A person will call you as soon as possible. If you are in danger right now, call 000. Lifeline: 13 11 14, any time."
                : "You don't need to book. Our Product Safety team will call you as soon as possible. If anyone is hurt, call 000. Poisons Information: 13 11 26."
              : "Ask for a call back today, or book a time that suits you."}
          </p>
        </div>
        {!urgent && <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-muted hover:text-ink">Close</button>}
      </div>

      {urgent ? callForm : (
        <>
          <div role="tablist" className="mb-3 inline-flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
            {([["call", "Call me back today"], ["book", "Book a time"]] as const).map(([k, label]) => (
              <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === k ? "bg-indigo-600 text-white" : "text-ink hover:bg-slate-100"}`}>{label}</button>
            ))}
          </div>
          {tab === "call" ? callForm : (
            <form action={bkAction} className="space-y-3">
              <input type="hidden" name="case_id" value={caseId ?? ""} />
              <input type="hidden" name="slot" value={slot} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium">Who would you like to talk to?
                  <select name="team" value={team} onChange={(e) => { setTeam(e.target.value); setSlot(""); }} className={`${field} mt-1`}>
                    {teams.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium">How?
                  <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className={`${field} mt-1`}>
                    <option>Phone call</option><option>Video call</option>{uni && <option>In person</option>}
                  </select>
                </label>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Day</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {days.map(([k, label]) => (
                    <button key={k} type="button" onClick={() => { setDay(k); setSlot(""); }}
                      className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium ring-1 ${shownDay === k ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white ring-slate-200 hover:ring-indigo-300"}`}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-sm font-medium"><CalendarIcon className="h-4 w-4" /> Time (Sydney time)</p>
                <div className="flex flex-wrap gap-2">
                  {free.filter((s) => dayKey(s) === shownDay).map((s) => (
                    <button key={s} type="button" onClick={() => setSlot(s)} aria-pressed={slot === s}
                      className={`rounded-lg px-2.5 py-1 text-sm ring-1 ${slot === s ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white ring-slate-200 hover:ring-indigo-300"}`}>{timeLabel(s)}</button>
                  ))}
                  {free.length === 0 && <p className="text-sm text-muted">No times are free right now. Please ask for a call back instead.</p>}
                </div>
              </div>
              {mode === "Phone call" && (
                <label className="block text-sm font-medium">Your phone number
                  <input name="phone" type="tel" required defaultValue={options?.phone ?? ""} placeholder="0412 345 678" className={`${field} mt-1`} autoComplete="tel" />
                </label>
              )}
              <label className="block text-sm font-medium">What would you like to talk about? (optional)
                <textarea name="note" rows={2} maxLength={500} className={`${field} mt-1`} />
              </label>
              <button disabled={bkPending || !slot} className={btnPrimary}><CalendarIcon className="h-4 w-4" /> {bkPending ? "Booking…" : slot ? `Book ${dayLabel(slot)}, ${timeLabel(slot)}` : "Pick a time"}</button>
              {bk.error && <p role="alert" className="text-sm text-bad">{bk.error}</p>}
            </form>
          )}
        </>
      )}
    </div>
  );
}
