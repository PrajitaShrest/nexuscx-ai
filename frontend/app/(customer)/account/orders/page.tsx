import Link from "next/link";
import { listMyOrders } from "@/lib/data/shop";
import { PageHead } from "@/components/CustomerShell";
import { btnPrimary } from "@/components/ShopUI";
import OrderList from "./OrderList";
import type { Metadata } from "next";
import { requireShop } from "@/lib/industry";

export const metadata: Metadata = { title: "My orders" };

export default async function OrdersPage() {
  await requireShop("/support");
  const orders = await listMyOrders();
  return (
    <>
      <PageHead title="My orders" sub="Track deliveries, return items, or ask the AI about any order."
        action={<Link href="/support" className={btnPrimary}>Ask about an order</Link>} />
      <OrderList orders={orders} />
    </>
  );
}
