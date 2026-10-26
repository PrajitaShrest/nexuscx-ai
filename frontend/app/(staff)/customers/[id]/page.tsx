import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import Avatar from "@/components/Avatar";
import { STATUS, Pill } from "@/components/Badges";
import { OrderPill } from "@/components/ShopUI";
import { displayMobile } from "@/lib/auth/phone";
import { can, getMe } from "@/lib/data/me";
import { getCustomer } from "@/lib/data/customers";
import { ago, day, money } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Customers" needs="view_cases" />;
  const { id } = await params;
  const c = await getCustomer(id);
  if (!c) notFound();

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/customers" />
      <main className="min-w-0 flex-1 space-y-6 p-6">
        <Link href="/customers" className="text-sm text-indigo-700 hover:underline">← All customers</Link>
        <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-5">
          <Avatar name={c.name} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{c.name}</h1>
            <p className="text-sm text-gray-500">{c.email}{c.phone ? ` · ${displayMobile(c.phone)}` : ""} · <span className="capitalize">{c.tier}</span> customer since {day(c.created_at)}</p>
          </div>
          <dl className="grid grid-cols-4 gap-6 text-center text-sm">
            {[["Orders", c.orders], ["Spent", money(c.spent_cents)], ["Cases", c.cases], ["Rating", c.avg_rating !== null ? `${c.avg_rating} ★` : "—"]].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-gray-500">{k}</dt><dd className="text-lg font-semibold">{v}</dd></div>
            ))}
          </dl>
        </section>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-xl border bg-white p-4">
            <h2 className="mb-2 font-semibold">Cases</h2>
            {c.recentCases.length === 0 ? <p className="text-sm text-gray-500">No cases yet.</p> : (
              <ul className="divide-y">{c.recentCases.map((k) => (
                <li key={k.case_id}><Link href={`/cases/${k.case_id}`} className="flex items-center gap-3 py-2.5 hover:bg-indigo-50/40">
                  <span className="w-20 text-sm font-medium text-indigo-700">{k.case_number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{k.subject}</span>
                  <span className="text-xs text-gray-500">{ago(k.updated_at)}</span>
                  <Pill map={STATUS} value={k.status} />
                </Link></li>
              ))}</ul>
            )}
          </section>
          <section className="rounded-xl border bg-white p-4">
            <h2 className="mb-2 font-semibold">Orders</h2>
            {c.recentOrders.length === 0 ? <p className="text-sm text-gray-500">No orders yet.</p> : (
              <ul className="divide-y">{c.recentOrders.map((o) => (
                <li key={o.order_id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-20 font-medium">{o.order_number}</span>
                  <span className="flex-1 text-gray-500">{day(o.created_at)}</span>
                  <span>{money(o.total_cents)}</span>
                  <OrderPill status={o.status} />
                </li>
              ))}</ul>
            )}
            <Link href="/orders" className="mt-3 inline-block text-xs font-semibold text-indigo-700 hover:underline">Open the order queue</Link>
          </section>
        </div>
      </main>
    </div>
  );
}
