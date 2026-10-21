import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/data/shop";
import { PageHead } from "@/components/CustomerShell";
import { Panel } from "@/components/ShopUI";
import ReturnForm from "./ReturnForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Return or exchange" };

export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOrder(id);
  if (!o) notFound();
  const deliveredAt = o.order_events.find((e) => e.status === "delivered")?.created_at ?? o.updated_at;
  const daysLeft = 30 - Math.floor((Date.now() - new Date(deliveredAt).getTime()) / 864e5);

  return (
    <>
      <div>
        <Link href={`/account/orders/${o.order_id}`} className="text-sm font-medium text-indigo-700 hover:underline">← Order {o.order_number}</Link>
        <div className="mt-2"><PageHead title="Return or exchange" sub={`Order ${o.order_number}. Free returns within 30 days of delivery.`} /></div>
      </div>
      {o.status !== "delivered" ? (
        <Panel><p className="text-muted">You can return or exchange items once this order has been delivered.</p></Panel>
      ) : daysLeft < 0 ? (
        <Panel><p className="text-muted">The 30-day return window for this order has ended. If an item is faulty, <Link href={`/account/orders/${o.order_id}`} className="font-semibold text-indigo-700">ask us for help</Link>.</p></Panel>
      ) : (
        <ReturnForm orderId={o.order_id} items={o.order_items} daysLeft={daysLeft} />
      )}
    </>
  );
}
