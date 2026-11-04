"use client";

import { useState, useTransition } from "react";
import { cancelRequest } from "@/app/(customer)/account/requests/actions";

// "Cancel this request", with a second click to confirm
export default function CancelRequest({ id }: { id: string }) {
  const [sure, setSure] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!sure) return <button type="button" onClick={() => setSure(true)} className="text-sm font-medium text-muted underline hover:text-ink">Cancel this request</button>;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm">
      <span>Cancel this request?</span>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await cancelRequest(id); if (r.error) setError(r.error); })}
        className="rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{pending ? "Cancelling…" : "Yes, cancel"}</button>
      <button type="button" onClick={() => setSure(false)} className="rounded-lg px-3 py-1 font-semibold hover:bg-white">Keep it</button>
      {error && <p role="alert" className="w-full text-bad">{error}</p>}
    </div>
  );
}
