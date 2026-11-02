"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChangeItem } from "@/lib/data/shop";
import { sizeOptions } from "../actions";
import { RepeatIcon } from "@/components/Icons";
import { btnPrimary } from "@/components/ShopUI";

// "Change size or colour" on an order: the Orders Agent checks the rules
// (last 2 days, not shipped) and makes the change straight away.
export default function ChangeSize({ orderId, startOpen }: { orderId: string; startOpen: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChangeItem[] | null>(null);
  const [item, setItem] = useState("");
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => start(async () => {
    setOpen(true); setMsg(null);
    const r = await sizeOptions(orderId);
    if (r.status !== "verified" || !r.items) { setMsg({ ok: false, text: r.message ?? "Something went wrong." }); return; }
    setItems(r.items); setItem(r.items[0].order_item_id); setValue("");
    setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  });
  const change = () => start(async () => {
    const r = await sizeOptions(orderId, item, value);
    if (r.status !== "changed") { setMsg({ ok: false, text: r.message ?? "Something went wrong." }); return; }
    setMsg({ ok: true, text: r.message ?? "Done." }); setItems(null);
    router.refresh();
  });

  // Opened from the chat: show the options straight away
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (startOpen) load(); }, []);

  const chosen = items?.find((i) => i.order_item_id === item);
  return (
    <div ref={ref} className="w-full">
      {!open && (
        <button type="button" onClick={load} className={btnPrimary}><RepeatIcon className="h-4 w-4" /> Change size or colour</button>
      )}
      {open && (
        <div className="mt-2 w-full max-w-md space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm">
          {pending && !items && <p className="text-muted">Checking your order…</p>}
          {chosen && (
            <>
              {items!.length > 1 && (
                <select value={item} onChange={(e) => { setItem(e.target.value); setValue(""); }} disabled={pending}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                  {items!.map((i) => <option key={i.order_item_id} value={i.order_item_id}>{i.product_name}</option>)}
                </select>
              )}
              <p><span className="font-semibold">{chosen.product_name}</span>: {chosen.label.toLowerCase()} now <strong>{chosen.current ?? "not set"}</strong>. Choose the new one:</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={chosen.label}>
                {chosen.options.map((o) => (
                  <button key={o} type="button" role="radio" aria-checked={value === o} disabled={pending || o === chosen.current} onClick={() => setValue(o)}
                    className={`min-w-14 rounded-xl border bg-white px-3 py-2 font-semibold transition ${value === o ? "border-indigo-500 text-indigo-700 ring-2 ring-indigo-200" : "border-slate-300 hover:border-indigo-300"} disabled:cursor-not-allowed disabled:opacity-40`}>
                    {o}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={change} disabled={pending || !value} className={btnPrimary}>
                  {pending ? "Changing…" : value ? `Change to ${value}` : "Choose a size"}
                </button>
                <button type="button" onClick={() => setOpen(false)} disabled={pending} className="rounded-xl px-3 py-2 font-medium text-muted hover:bg-white">Not now</button>
              </div>
              <p className="text-xs text-muted">Free, and your delivery date stays the same.</p>
            </>
          )}
          {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "font-medium text-emerald-700" : "text-bad"}>{msg.text}</p>}
        </div>
      )}
    </div>
  );
}
