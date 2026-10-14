"use client";

import { useActionState, useState } from "react";
import { rate, type RateState } from "../actions";
import { StarIcon } from "@/components/Icons";
import { btnPrimary } from "@/components/ShopUI";

const WORDS = ["", "Poor", "Not great", "OK", "Good", "Excellent"];

export default function RateChat({ caseId, rated }: { caseId: string; rated: number | null }) {
  const [state, action, pending] = useActionState<RateState, FormData>(rate, {});
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  if (rated || state.done) {
    const n = rated ?? stars;
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <span className="flex">{[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} className={`h-4 w-4 ${i <= n ? "fill-amber-400 text-amber-400" : "text-emerald-300"}`} />)}</span>
        Thanks for rating this chat!
      </div>
    );
  }
  const shown = hover || stars;
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
      <input type="hidden" name="case_id" value={caseId} />
      <input type="hidden" name="rating" value={stars} />
      <p className="font-semibold">How did we do?</p>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onClick={() => setStars(i)} onMouseEnter={() => setHover(i)} aria-label={`${i} star${i > 1 ? "s" : ""}`} aria-pressed={stars === i}
            className="rounded p-0.5"><StarIcon className={`h-7 w-7 transition ${i <= shown ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} /></button>
        ))}
        <span className="ml-2 text-sm text-muted">{WORDS[shown]}</span>
      </div>
      {stars > 0 && (
        <>
          <textarea name="comment" rows={2} maxLength={500} placeholder="Tell us more (optional)"
            className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
          <button className={btnPrimary} disabled={pending}>{pending ? "Sending…" : "Send rating"}</button>
        </>
      )}
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}
