import Link from "next/link";
import { listMyOrders } from "@/lib/data/shop";
import { PageHead } from "@/components/CustomerShell";
import { btnPrimary } from "@/components/ShopUI";
import OrderList from "./OrderList";

export default async function OrdersPage() {
  const orders = await listMyOrders();
  return (
    <>
      <PageHead title="My orders" sub="Track deliveries, buy again or get help with an order."
        action={<Link href="/shop" className={btnPrimary}>Shop products</Link>} />
      <OrderList orders={orders} />
    </>
  );
}
