"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { changeableOrders, type ChangeableOrder } from "./actions";
import { BotIcon, RepeatIcon } from "@/components/Icons";

// Words that mean "change the size or colour on my order"
export const CHANGE_REQUEST = /\b(change|swap|switch|exchange|wrong|different|bigger|smaller|instead)\b[\s\S]*\b(size|sizes|colou?r|band)\b|\b(size|colou?r|band)\b[\s\S]*\b(change|swap|switch|exchange|wrong|bigger|smaller|instead)\b/i;

// The AI's answer to "can I change the size?": a button to each order it can still change.
// The change itself is made on the order page (Change size or colour).
export default function OrderChange({ text, onHuman }: { text: string; onHuman: () => void }) {
  const [orders, setOrders] = useState<ChangeableOrder[] | null>(null);
  useEffect(() => { changeableOrders().then(setOrders).catch(() => setOrders([])); }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-[15px] text-white shadow-sm">{text}</div>
      </div>
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
          <BotIcon className="h-5 w-5" />
        </div>
        <div className="max-w-[85%] space-y-3 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-[15px] text-ink shadow-sm">
          {orders === null ? (
            <p className="text-muted">Checking your orders…</p>
          ) : orders.length > 0 ? (
            <>
              <p>Yes! You can change the size or colour yourself, straight away. Open the order and choose the new one:</p>
              <div className="flex flex-col gap-2">
                {orders.map((o) => (
                  <Link key={o.order_id} href={`/account/orders/${o.order_id}?change=1`}
                    className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 hover:border-indigo-400 hover:bg-indigo-50">
                    <RepeatIcon className="h-4 w-4 shrink-0 text-indigo-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-indigo-700">Change size · {o.order_number}</span>
                      <span className="block truncate text-xs text-muted">{o.items}</span>
                    </span>
                  </Link>
                ))}
              </div>
              <p className="text-xs text-muted">Free, and your delivery date stays the same.</p>
            </>
          ) : (
            <>
              <p>I can change a size or colour straight away when the order was placed in the last 2 days and hasn&apos;t shipped yet. None of your orders can be changed that way right now.</p>
              <p>If your order has arrived, you can exchange it for free within 30 days from <Link href="/account/orders" className="font-semibold text-indigo-700 hover:underline">My orders</Link>. Otherwise, our team can check for you.</p>
              <button type="button" onClick={onHuman} className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium hover:bg-slate-50">Talk to a person</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
