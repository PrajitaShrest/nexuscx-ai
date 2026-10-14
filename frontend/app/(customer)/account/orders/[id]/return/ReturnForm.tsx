"use client";

import { useActionState, useState } from "react";
import type { OrderItem } from "@/lib/data/shop";
import { money } from "@/lib/format";
import { Panel, ProductTile, RETURN_REASONS, btnPrimary } from "@/components/ShopUI";
import { RepeatIcon, TruckIcon } from "@/components/Icons";
import { submitReturn, type ReturnState } from "./actions";

export default function ReturnForm({ orderId, items, daysLeft }: { orderId: string; items: OrderItem[]; daysLeft: number }) {
  const [state, action, pending] = useActionState<ReturnState, FormData>(submitReturn, {});
  const [kind, setKind] = useState<"return" | "exchange">("exchange");
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<Record<string, { qty: number; want: string }>>({});
  const chosen = items.filter((i) => picked[i.order_item_id]);
  const refund = chosen.reduce((s, i) => s + i.unit_price_cents * picked[i.order_item_id].qty, 0);
  const toggle = (i: OrderItem) => setPicked((p) => {
    const n = { ...p };
    if (n[i.order_item_id]) delete n[i.order_item_id]; else n[i.order_item_id] = { qty: 1, want: "" };
    return n;
  });
  const set = (id: string, patch: Partial<{ qty: number; want: string }>) => setPicked((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  return (
    <form action={action} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="reason" value={reason} />
      <input type="hidden" name="items" value={JSON.stringify(chosen.map((i) => ({ order_item_id: i.order_item_id, quantity: picked[i.order_item_id].qty, exchange_for: picked[i.order_item_id].want })))} />

      <div className="min-w-0 space-y-6 lg:col-span-2">
        <Panel title="1. What would you like?">
          <div className="grid gap-3 sm:grid-cols-2">
            {([["exchange", "Exchange", "Swap for a different size, colour or a new one", <RepeatIcon key="r" className="h-5 w-5" />],
               ["return", "Return for a refund", "Send it back and get your money back", <TruckIcon key="t" className="h-5 w-5" />]] as const).map(([k, title, text, icon]) => (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                className={`flex gap-3 rounded-2xl border p-4 text-left ${kind === k ? "border-indigo-400 bg-indigo-50/60 ring-2 ring-indigo-200" : "border-slate-200 hover:bg-slate-50"}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{icon}</span>
                <span><span className="block font-semibold">{title}</span><span className="block text-sm text-muted">{text}</span></span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="2. Which items?">
          <ul className="space-y-3">
            {items.map((i) => {
              const p = picked[i.order_item_id];
              return (
                <li key={i.order_item_id} className={`rounded-2xl border p-3 ${p ? "border-indigo-300 bg-indigo-50/30" : "border-slate-200"}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input type="checkbox" checked={!!p} onChange={() => toggle(i)} className="h-4 w-4 accent-indigo-600" />
                    <ProductTile category={i.category} size="sm" />
                    <span className="min-w-0 flex-1"><span className="block font-semibold">{i.product_name}</span><span className="block text-xs text-muted">Bought {i.quantity} × {money(i.unit_price_cents)}</span></span>
                  </label>
                  {p && (
                    <div className="mt-3 grid gap-3 pl-7 sm:grid-cols-2">
                      {i.quantity > 1 && (
                        <label className="text-sm">How many?
                          <select value={p.qty} onChange={(e) => set(i.order_item_id, { qty: Number(e.target.value) })} className="ml-2 rounded-lg border border-slate-300 px-2 py-1">
                            {Array.from({ length: i.quantity }, (_, n) => <option key={n + 1}>{n + 1}</option>)}
                          </select>
                        </label>
                      )}
                      {kind === "exchange" && (
                        <label className="text-sm sm:col-span-2">What would you like instead?
                          <input value={p.want} onChange={(e) => set(i.order_item_id, { want: e.target.value })} maxLength={100} placeholder="e.g. Size L, Black, or the same item (replacement)"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
                        </label>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="3. Why?">
          <div className="flex flex-wrap gap-2">
            {Object.entries(RETURN_REASONS).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setReason(k)} aria-pressed={reason === k}
                className={`rounded-full px-3.5 py-1.5 text-sm ${reason === k ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{label}</button>
            ))}
          </div>
          <label className="mt-4 block text-sm font-semibold">Anything else we should know? <span className="font-normal text-muted">(optional)</span>
            <textarea name="details" rows={3} maxLength={500} placeholder="e.g. The box was crushed and the left ear cup is cracked."
              className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
          </label>
        </Panel>
      </div>

      <aside className="min-w-0">
        <div className="sticky top-20 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Summary</h2>
          <p className="text-sm text-muted">{chosen.length === 0 ? "No items chosen yet." : chosen.map((i) => `${picked[i.order_item_id].qty} × ${i.product_name}`).join(", ")}</p>
          {kind === "return" && chosen.length > 0 && <p className="flex justify-between border-t pt-3 font-semibold"><span>Estimated refund</span><span>{money(refund)}</span></p>}
          <ul className="space-y-1.5 border-t pt-3 text-xs text-muted">
            <li>• Free return label emailed once approved</li>
            <li>• We usually reply within 1 business day</li>
            <li>• {daysLeft} day{daysLeft === 1 ? "" : "s"} left in your return window</li>
          </ul>
          {state.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-bad">{state.error}</p>}
          <button className={`${btnPrimary} w-full py-3`} disabled={pending || chosen.length === 0 || !reason}>
            {pending ? "Sending…" : kind === "exchange" ? "Request exchange" : "Request return"}
          </button>
        </div>
      </aside>
    </form>
  );
}
