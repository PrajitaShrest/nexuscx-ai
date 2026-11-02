"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ChangeItem } from "@/lib/data/shop";
import { changeOrderOption } from "./actions";
import { BotIcon, ShieldIcon } from "@/components/Icons";

// Words that mean "change the size or colour on my order"
export const CHANGE_REQUEST = /\b(change|swap|switch|exchange|wrong|different|bigger|smaller|instead)\b[\s\S]*\b(size|sizes|colou?r|band)\b|\b(size|colou?r|band)\b[\s\S]*\b(change|swap|switch|exchange|wrong|bigger|smaller|instead)\b/i;

const field = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";
const primary = "rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-50";

function Bot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
        <BotIcon className="h-5 w-5" />
      </div>
      <div className="max-w-[85%] space-y-3 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-[15px] text-ink shadow-sm">{children}</div>
    </div>
  );
}

// The Orders Agent changes a size or colour itself:
// 1. asks for the order number and delivery postcode (to check it is really you)
// 2. checks the rules (ordered in the last 2 days, not shipped yet)
// 3. shows the options, makes the change and closes the request
export default function OrderChange({ text, onHuman }: { text: string; onHuman: () => void }) {
  const [pending, start] = useTransition();
  const [order, setOrder] = useState(text.match(/NX-?\d{3,8}/i)?.[0].toUpperCase().replace(/^NX(\d)/, "NX-$1") ?? "");
  const [postcode, setPostcode] = useState("");
  const [items, setItems] = useState<ChangeItem[] | null>(null);
  const [item, setItem] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ message: string; case_number?: string; order_id?: string } | null>(null);

  const check = () => start(async () => {
    setError("");
    const r = await changeOrderOption(order, postcode, null, null);
    if (r.status !== "verified" || !r.items) { setError(r.message ?? "Something went wrong."); return; }
    setItems(r.items);
    setItem(r.items[0].order_item_id);
    setValue("");
  });
  const change = () => start(async () => {
    setError("");
    const r = await changeOrderOption(order, postcode, item, value);
    if (r.status !== "changed") { setError(r.message ?? "Something went wrong."); return; }
    setDone({ message: r.message ?? "Done.", case_number: r.case_number, order_id: r.order_id });
  });
  const chosen = items?.find((i) => i.order_item_id === item);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-[15px] text-white shadow-sm">{text}</div>
      </div>

      <Bot>
        <p>Yes, I can change the size or colour for you. I can do this myself if the order was placed in the last 2 days and hasn&apos;t shipped yet.</p>
        <p>First, so I know it&apos;s really you, please tell me:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Order number</span>
            <input value={order} onChange={(e) => setOrder(e.target.value)} placeholder="e.g. NX-1009" disabled={!!items || pending} className={field} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Delivery postcode</span>
            <input value={postcode} onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="e.g. 2000"
              disabled={!!items || pending} className={field} />
          </label>
        </div>
        {!items && (
          <button type="button" onClick={check} disabled={pending || !order.trim() || postcode.length !== 4} className={primary}>
            {pending ? "Checking…" : "Check my order"}
          </button>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted"><ShieldIcon className="h-3.5 w-3.5" /> Checked against your account. Every change is logged.</p>
      </Bot>

      {items && !done && (
        <Bot>
          <p>Thanks, that&apos;s confirmed. Order <strong>{order.toUpperCase()}</strong> can still be changed. What would you like instead?</p>
          {items.length > 1 && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Item</span>
              <select value={item} onChange={(e) => { setItem(e.target.value); setValue(""); }} className={field} disabled={pending}>
                {items.map((i) => <option key={i.order_item_id} value={i.order_item_id}>{i.product_name}</option>)}
              </select>
            </label>
          )}
          {chosen && (
            <div className="text-sm">
              <p className="mb-2"><span className="font-medium">{chosen.product_name}</span>: {chosen.label.toLowerCase()} now <strong>{chosen.current ?? "not set"}</strong></p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={chosen.label}>
                {chosen.options.map((o) => (
                  <button key={o} type="button" role="radio" aria-checked={value === o} disabled={pending || o === chosen.current} onClick={() => setValue(o)}
                    className={`min-w-14 rounded-xl border px-3 py-2 font-semibold transition ${value === o ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200" : "border-slate-300 hover:border-indigo-300"} disabled:cursor-not-allowed disabled:opacity-40`}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="button" onClick={change} disabled={pending || !value} className={primary}>
            {pending ? "Changing…" : value ? `Change to ${value}` : "Choose an option"}
          </button>
        </Bot>
      )}

      {done && (
        <Bot>
          <p>{done.message}</p>
          <p className="text-sm text-muted">This request is closed{done.case_number ? ` (${done.case_number})` : ""}. You&apos;ll also see the change in your order history.</p>
          {done.order_id && <Link href={`/account/orders/${done.order_id}`} className="inline-block text-sm font-semibold text-indigo-700 hover:underline">View order →</Link>}
        </Bot>
      )}

      {error && (
        <Bot>
          <p>{error}</p>
          <button type="button" onClick={onHuman} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium hover:bg-slate-50">Talk to a person</button>
        </Bot>
      )}
    </div>
  );
}
