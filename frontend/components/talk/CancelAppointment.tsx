"use client";

import { useState, useTransition } from "react";
import { cancelAppointment } from "@/app/(customer)/account/appointments/actions";

// "Cancel", with a second click to confirm
export default function CancelAppointment({ id }: { id: string }) {
  const [sure, setSure] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!sure) return <button type="button" onClick={() => setSure(true)} className="text-sm font-medium text-muted underline hover:text-ink">Cancel</button>;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 px-3 py-1.5 text-sm">
      <span>Cancel it?</span>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await cancelAppointment(id); if (r.error) setError(r.error); })}
        className="rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{pending ? "Cancelling…" : "Yes"}</button>
      <button type="button" onClick={() => setSure(false)} className="rounded-lg px-3 py-1 font-semibold hover:bg-white">Keep it</button>
      {error && <p role="alert" className="w-full text-bad">{error}</p>}
    </div>
  );
}
