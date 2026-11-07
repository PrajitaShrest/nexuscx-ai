"use client";

import { useState, useTransition } from "react";
import { updateBooking } from "./actions";

// Take it, mark it done or missed, or cancel (with a short note)
export default function BookingActions({ id, taken }: { id: string; taken: boolean }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const go = (action: string) => start(async () => { const r = await updateBooking(id, action, note); setError(r.error ?? ""); if (!r.error) setNote(""); });
  const btn = "rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!taken && <button type="button" disabled={pending} onClick={() => go("take")} className={`${btn} bg-indigo-600 text-white hover:bg-indigo-700`}>I&apos;ll take it</button>}
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Note (optional)" aria-label="Note"
        className="w-36 rounded-md border px-2 py-1 text-xs" />
      <button type="button" disabled={pending} onClick={() => go("done")} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>Done</button>
      <button type="button" disabled={pending} onClick={() => go("missed")} className={`${btn} border bg-white hover:bg-gray-50`}>No answer</button>
      <button type="button" disabled={pending} onClick={() => go("cancel")} className={`${btn} text-gray-500 hover:text-gray-900`}>Cancel</button>
      {error && <p role="alert" className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
