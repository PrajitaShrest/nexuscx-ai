"use client";

import Link from "next/link";
import { useState } from "react";
import type { Order } from "@/lib/data/shop";
import { day, money } from "@/lib/format";
import { EmptyState, OrderPill, OrderTracker, ProductTile, btnPrimary } from "@/components/ShopUI";
import { PackageIcon } from "@/components/Icons";

const TABS = [
  { id: "active", label: "In progress", test: (s: string) => ["placed", "processing", "shipped"].includes(s) },
  { id: "delivered", label: "Delivered", test: (s: string) => s === "delivered" },
  { id: "cancelled", label: "Cancelled", test: (s: string) => s === "cancelled" },
  { id: "all", label: "All", test: () => true },
] as const;

export default function OrderList({ orders }: { orders: Order[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(orders.some((o) => TABS[0].test(o.status)) ? "active" : "all");
  const t = TABS.find((x) => x.id === tab)!;
  const shown = orders.filter((o) => t.test(o.status));

  if (orders.length === 0) {
    return <EmptyState icon={<PackageIcon className="h-6 w-6" />} title="You haven't ordered anything yet"
      text="Your orders and their delivery progress will show here." action={<Link href="/shop" className={btnPrimary}>Browse products</Link>} />;
  }
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm" role="tablist">
        {TABS.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
            className={`rounded-lg px-3.5 py-1.5 font-medium ${tab === x.id ? "bg-white text-indigo-700 shadow-sm" : "text-muted hover:text-ink"}`}>
            {x.label} <span className="text-xs opacity-60">{orders.filter((o) => x.test(o.status)).length}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-muted">No orders here.</p> : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {shown.map((o) => (
            <li key={o.order_id}>
              <Link href={`/account/orders/${o.order_id}`} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{o.order_number}</p>
                    <p className="text-xs text-muted">Placed {day(o.created_at)}</p>
                  </div>
                  <OrderPill status={o.status} />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {o.order_items.slice(0, 4).map((i) => <ProductTile key={i.order_item_id} category={i.category} size="sm" />)}
                  <span className="ml-1 min-w-0 flex-1 truncate text-sm text-muted">{o.order_items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}</span>
                </div>
                <div className="mt-4"><OrderTracker status={o.status} compact /></div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted">{o.order_items.reduce((s, i) => s + i.quantity, 0)} items</span>
                  <span className="font-bold">{money(o.total_cents)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
