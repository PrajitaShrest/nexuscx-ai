import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import { can, getMe } from "@/lib/data/me";
import { listOrderQueue } from "@/lib/data/shop";
import OrderQueue from "./OrderQueue";
import type { Metadata } from "next";
import { requireShop } from "@/lib/industry";

export const metadata: Metadata = { title: "Orders" };

// Staff view of every customer order, matching the customer's My orders page.
export default async function StaffOrdersPage() {
  await requireShop("/dashboard");
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Orders" needs="view_cases" />;
  const { data: orders, error } = await listOrderQueue();
  const stats = [
    ["To process", orders.filter((o) => o.status === "placed").length],
    ["Packing", orders.filter((o) => o.status === "processing").length],
    ["On the way", orders.filter((o) => o.status === "shipped").length],
    ["Need help", orders.filter((o) => o.open_cases > 0).length],
  ] as const;

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/orders" />
      <main className="min-w-0 flex-1 p-6">
        <h1 className="text-xl font-semibold">Orders</h1>
        <p className="mb-4 text-sm text-gray-500">Every customer order. Move orders along and see which ones have an open help request.</p>
        <div className="mb-6 flex flex-wrap gap-4">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-white px-5 py-3"><p className="text-xs text-gray-500">{k}</p><p className="text-2xl font-semibold">{v}</p></div>
          ))}
        </div>
        {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
        <OrderQueue orders={orders} canEdit={can(me, "resolve_cases")} />
      </main>
    </div>
  );
}
