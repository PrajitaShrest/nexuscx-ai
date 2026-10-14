"use client";

import { useActionState, useState } from "react";
import type { QueueOrder } from "@/lib/data/shop";
import { dayTime, money } from "@/lib/format";
import { OrderPill } from "@/components/ShopUI";
import { updateOrder, type StaffOrderState } from "./actions";

const TABS = [
  ["open", "Open", (s: string) => ["placed", "processing", "shipped"].includes(s)],
  ["delivered", "Delivered", (s: string) => s === "delivered"],
  ["cancelled", "Cancelled", (s: string) => s === "cancelled"],
  ["all", "All", () => true],
] as const;

const NEXT: Record<string, { status: string; label: string }> = {
  placed: { status: "processing", label: "Start packing" },
  processing: { status: "shipped", label: "Mark shipped" },
  shipped: { status: "delivered", label: "Mark delivered" },
};

function Actions({ o }: { o: QueueOrder }) {
  const [state, action, pending] = useActionState<StaffOrderState, FormData>(updateOrder, {});
  const next = NEXT[o.status];
  if (!next) return <span className="text-xs text-gray-400">—</span>;
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="order_id" value={o.order_id} />
      {next.status === "shipped" && (
        <input name="tracking" required minLength={4} placeholder="Tracking no." aria-label={`Tracking number for ${o.order_number}`}
          className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs" />
      )}
      <button name="status" value={next.status} disabled={pending} className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{next.label}</button>
      {["placed", "processing"].includes(o.status) && (
        <button name="status" value="cancelled" formNoValidate disabled={pending} className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Cancel</button>
      )}
      {state.error && <span role="alert" className="w-full text-xs text-red-700">{state.error}</span>}
    </form>
  );
}

export default function OrderQueue({ orders, canEdit }: { orders: QueueOrder[]; canEdit: boolean }) {
  const [tab, setTab] = useState<string>("open");
  const [q, setQ] = useState("");
  const t = TABS.find((x) => x[0] === tab)!;
  const shown = orders.filter((o) => t[2](o.status) && `${o.order_number} ${o.customer_name} ${o.customer_email}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="flex gap-4 text-sm">
          {TABS.map(([id, label, test]) => (
            <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id}
              className={`border-b-2 pb-1 ${tab === id ? "border-indigo-600 font-semibold text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-900"}`}>
              {label} <span className="text-xs text-gray-400">{orders.filter((o) => test(o.status)).length}</span>
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order, customer or email" aria-label="Search orders"
          className="ml-auto w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm sm:w-64" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>{["Order", "Customer", "Items", "Total", "Placed", "Status", "Help", ...(canEdit ? ["Next step"] : [])].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {shown.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No orders here.</td></tr>}
            {shown.map((o) => (
              <tr key={o.order_id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{o.order_number}</p>
                  {o.tracking_number && <p className="font-mono text-xs text-gray-500">{o.tracking_number}</p>}
                </td>
                <td className="px-4 py-3">
                  <p>{o.customer_name}</p>
                  <p className="max-w-56 truncate text-xs text-gray-500" title={o.ship_address}>{o.ship_address}</p>
                </td>
                <td className="px-4 py-3">{o.item_count}</td>
                <td className="px-4 py-3 font-medium">{money(o.total_cents)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">{dayTime(o.created_at)}</td>
                <td className="px-4 py-3"><OrderPill status={o.status} /></td>
                <td className="px-4 py-3">{o.open_cases > 0
                  ? <span className="whitespace-nowrap rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs text-red-700">{o.open_cases} open</span>
                  : <span className="text-xs text-gray-400">—</span>}</td>
                {canEdit && <td className="px-4 py-3"><Actions o={o} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
