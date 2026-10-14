"use client";

import { useActionState, useState } from "react";
import { ask, cancel, type OrderActionState } from "../actions";
import { btnPrimary } from "@/components/ShopUI";
import { SendIcon, XIcon } from "@/components/Icons";

const empty: OrderActionState = {};

export function CancelButton({ orderId, number }: { orderId: string; number: string }) {
  const [state, action, pending] = useActionState(cancel, empty);
  const [sure, setSure] = useState(false);
  if (!sure) {
    return (
      <button type="button" onClick={() => setSure(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-bad hover:bg-red-50">
        <XIcon className="h-4 w-4" /> Cancel order
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
      <input type="hidden" name="order_id" value={orderId} />
      <span className="text-sm text-bad">Cancel {number}?</span>
      <button disabled={pending} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{pending ? "Cancelling…" : "Yes, cancel"}</button>
      <button type="button" onClick={() => setSure(false)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink hover:bg-white">Keep it</button>
      {state.error && <p role="alert" className="w-full text-sm text-bad">{state.error}</p>}
    </form>
  );
}

export function AskForm({ orderId, delivered }: { orderId: string; delivered: boolean }) {
  const [state, action, pending] = useActionState(ask, empty);
  const [text, setText] = useState("");
  const reasons = delivered
    ? ["An item arrived damaged", "I received the wrong item", "An item is not working", "I have a question about my refund"]
    : ["Where is my order?", "Can I change the delivery address?", "My parcel is late", "I was charged twice"];
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <div className="flex flex-wrap gap-2">
        {reasons.map((r) => (
          <button key={r} type="button" onClick={() => setText(r)}
            className={`rounded-full px-3 py-1.5 text-sm ${text === r ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`}>{r}</button>
        ))}
      </div>
      <div className="flex items-end gap-2 rounded-2xl border border-slate-300 p-2 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
        <label htmlFor="ask" className="sr-only">Your question about this order</label>
        <textarea id="ask" name="message" rows={2} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Describe the problem…" className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none" />
        <button disabled={pending || text.trim().length < 5} aria-label="Send" className={`${btnPrimary} h-11 w-11 shrink-0 px-0`}><SendIcon className="h-4 w-4" /></button>
      </div>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}
