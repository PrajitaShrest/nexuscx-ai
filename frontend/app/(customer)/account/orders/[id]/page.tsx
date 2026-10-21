import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/data/shop";
import { day, dayTime, money } from "@/lib/format";
import { ChatPill, OrderPill, OrderTracker, Panel, ProductTile, ReturnPill, btnGhost, btnPrimary } from "@/components/ShopUI";
import { MapPinIcon, RepeatIcon, TruckIcon } from "@/components/Icons";
import { AskForm, CancelButton } from "./OrderActions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOrder(id);
  if (!o) notFound();
  const canCancel = ["placed", "processing"].includes(o.status);

  return (
    <>
      <div>
        <Link href="/account/orders" className="text-sm font-medium text-indigo-700 hover:underline">← My orders</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold sm:text-3xl">Order {o.order_number} <OrderPill status={o.status} /></h1>
            <p className="mt-1 text-muted">Placed {day(o.created_at)} · {money(o.total_cents)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {o.status === "delivered" && <Link href={`/account/orders/${o.order_id}/return`} className={btnPrimary}><RepeatIcon className="h-4 w-4" /> Return or exchange</Link>}
            <Link href={`/shop?reorder=${o.order_id}`} className={btnGhost}><RepeatIcon className="h-4 w-4" /> Buy again</Link>
            {canCancel && <CancelButton orderId={o.order_id} number={o.order_number} />}
          </div>
        </div>
      </div>

      <Panel>
        <OrderTracker status={o.status} />
        {o.status === "shipped" && o.tracking_number && (
          <p className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <TruckIcon className="h-4 w-4" /> On its way with the courier. Tracking number <span className="font-mono font-semibold">{o.tracking_number}</span>
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel title="Items">
            <ul className="divide-y divide-slate-100">
              {o.order_items.map((i) => (
                <li key={i.order_item_id} className="flex items-center gap-3 py-3">
                  <ProductTile category={i.category} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{i.product_name}</span>
                    <span className="block text-sm text-muted">{i.quantity} × {money(i.unit_price_cents)}</span>
                  </span>
                  <span className="font-semibold">{money(i.line_total_cents)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(o.subtotal_cents)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{o.shipping_cents === 0 ? "Free" : money(o.shipping_cents)}</dd></div>
              <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{money(o.total_cents)}</dd></div>
            </dl>
          </Panel>

          <Panel title="Need help with this order?">
            <p className="-mt-2 mb-4 text-sm text-muted">Pick a reason or write your own. Our assistant replies straight away, and anything that needs a person goes to our team.</p>
            <AskForm orderId={o.order_id} delivered={o.status === "delivered"} />
            {o.cases.length > 0 && (
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-sm font-semibold">Chats about this order</p>
                <ul className="space-y-2">
                  {o.cases.map((c) => (
                    <li key={c.case_id}>
                      <Link href={`/account/chats/${c.case_id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:border-indigo-300">
                        <span className="min-w-0 truncate">{c.case_number} · {c.subject?.replace(/^About my order [A-Z0-9-]+: /, "")}</span>
                        <ChatPill status={c.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel title="Delivery">
            <div className="flex gap-3 text-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><MapPinIcon className="h-5 w-5" /></span>
              <div>
                <p className="font-semibold">{o.ship_recipient}</p>
                <p className="text-muted">{o.ship_address}</p>
                {o.notes && <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-muted">Note: {o.notes}</p>}
              </div>
            </div>
            {canCancel && <p className="mt-4 text-xs text-muted">Need a different address? Cancel and order again before it ships, or ask us in the help box.</p>}
          </Panel>
          {o.return_requests.length > 0 && (
            <Panel title="Returns & exchanges">
              <ul className="space-y-2">
                {o.return_requests.map((r) => (
                  <li key={r.return_id}>
                    <Link href="/account/returns" className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:border-indigo-300">
                      <span className="capitalize">{r.kind} {r.return_number}</span><ReturnPill status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Timeline">
            <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
              {[...o.order_events].reverse().map((e, i) => (
                <li key={e.event_id} className="relative">
                  <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${i === 0 ? (e.status === "cancelled" ? "bg-rose-500" : "bg-indigo-600") : "bg-slate-300"}`} />
                  <p className="text-sm font-semibold">{e.note ?? e.status}</p>
                  <p className="text-xs text-muted">{dayTime(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </>
  );
}
