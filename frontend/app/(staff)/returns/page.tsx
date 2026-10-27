import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import { can, getMe } from "@/lib/data/me";
import { listReturnQueue } from "@/lib/data/workspace";
import { RETURN_REASONS, ReturnPill } from "@/components/ShopUI";
import { dayTime, money } from "@/lib/format";
import type { Metadata } from "next";
import { requireShop } from "@/lib/industry";

export const metadata: Metadata = { title: "Returns" };

// All return and exchange requests. Each one opens its case, where staff chat and approve.
export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireShop("/dashboard");
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Returns" needs="view_cases" />;
  const { tab = "open" } = await searchParams;
  const { data: returns, error } = await listReturnQueue();
  const open = (s: string) => ["requested", "approved", "received"].includes(s);
  const shown = returns.filter((r) => tab === "all" || (tab === "open" ? open(r.status) : !open(r.status)));
  const stats = [["To review", returns.filter((r) => r.status === "requested").length], ["Awaiting parcel", returns.filter((r) => r.status === "approved").length],
    ["To finish", returns.filter((r) => r.status === "received").length], ["Exchanges", returns.filter((r) => r.kind === "exchange").length]] as const;

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/returns" />
      <main className="min-w-0 flex-1 p-6">
        <h1 className="text-xl font-semibold">Returns &amp; exchanges</h1>
        <p className="mb-4 text-sm text-gray-500">Requests from customers. Open one to chat with the customer and approve, reject or complete it.</p>
        <div className="mb-6 flex flex-wrap gap-4">
          {stats.map(([k, v]) => <div key={k} className="rounded-lg border bg-white px-5 py-3"><p className="text-xs text-gray-500">{k}</p><p className="text-2xl font-semibold">{v}</p></div>)}
        </div>
        {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
        <div className="rounded-lg border bg-white">
          <div className="flex gap-4 border-b px-4 pt-3 text-sm">
            {[["open", "Open"], ["done", "Finished"], ["all", "All"]].map(([id, label]) => (
              <Link key={id} href={`/returns?tab=${id}`} className={`border-b-2 pb-2 ${tab === id ? "border-indigo-600 font-semibold text-indigo-700" : "border-transparent text-gray-500"}`}>{label}</Link>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>{["Request", "Customer", "Order", "Items", "Reason", "Refund", "Requested", "Status", ""].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {shown.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Nothing here.</td></tr>}
                {shown.map((r) => (
                  <tr key={r.return_id} className="align-top hover:bg-indigo-50/40">
                    <td className="px-4 py-3"><p className="font-medium">{r.return_number}</p><p className="text-xs capitalize text-gray-500">{r.kind}</p></td>
                    <td className="px-4 py-3">{r.customer?.user?.name}</td>
                    <td className="px-4 py-3">{r.order?.order_number}</td>
                    <td className="px-4 py-3 text-xs">{r.return_items.map((i) => <p key={i.return_item_id}>{i.quantity} × {i.product_name}{i.exchange_for ? ` → ${i.exchange_for}` : ""}</p>)}</td>
                    <td className="px-4 py-3 text-xs">{RETURN_REASONS[r.reason]}</td>
                    <td className="px-4 py-3">{r.kind === "return" ? money(r.refund_cents) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{dayTime(r.created_at)}</td>
                    <td className="px-4 py-3"><ReturnPill status={r.status} /></td>
                    <td className="px-4 py-3">{r.case_id && <Link href={`/cases/${r.case_id}`} className="whitespace-nowrap rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700">Open case</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
