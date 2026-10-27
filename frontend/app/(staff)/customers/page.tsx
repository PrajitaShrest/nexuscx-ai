import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import Avatar from "@/components/Avatar";
import { SearchIcon } from "@/components/Icons";
import { can, getMe } from "@/lib/data/me";
import { listCustomers } from "@/lib/data/customers";
import { ago, money } from "@/lib/format";
import { getPack } from "@/lib/industry";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getPack()).people };
}

const TIER: Record<string, string> = { standard: "bg-gray-100 text-gray-600", premium: "bg-amber-100 text-amber-800", vip: "bg-violet-100 text-violet-800" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [me, pack] = await Promise.all([getMe(), getPack()]);
  if (!can(me, "view_cases")) return <NoAccess me={me} page={pack.people} needs="view_cases" />;
  const who = pack.people.toLowerCase();
  const { q = "" } = await searchParams;
  const { data: rows, error } = await listCustomers(q);
  const withOpen = rows.filter((r) => r.open_cases > 0).length;

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/customers" />
      <main className="min-w-0 flex-1 p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{pack.people}</h1>
            <p className="text-sm text-gray-500">{rows.length} {who}{q ? ` matching "${q}"` : ""} · {withOpen} with an open case</p>
          </div>
          <form role="search" className="relative w-full max-w-xs">
            <label htmlFor="q" className="sr-only">Search {who}</label>
            <SearchIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input id="q" name="q" defaultValue={q} placeholder="Name, email or mobile" className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
          </form>
        </div>
        {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>{[pack.person, "Tier", ...(pack.shop ? ["Orders", "Spent"] : []), "Cases", ...(pack.shop ? ["Returns"] : []), "Rating", "Last activity"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((c) => (
                <tr key={c.customer_id} className="hover:bg-indigo-50/40">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.customer_id}`} className="flex items-center gap-3">
                      <Avatar name={c.name} size={32} />
                      <span><span className="block font-medium text-indigo-700">{c.name}</span><span className="block text-xs text-gray-500">{c.email}</span></span>
                    </Link>
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${TIER[c.tier] ?? TIER.standard}`}>{c.tier}</span></td>
                  {pack.shop && <td className="px-4 py-3">{c.orders}</td>}
                  {pack.shop && <td className="px-4 py-3 whitespace-nowrap">{money(c.spent_cents)}</td>}
                  <td className="px-4 py-3 whitespace-nowrap">{c.cases}{c.open_cases > 0 && <span className="ml-1.5 rounded-full bg-red-50 px-1.5 text-xs text-red-700">{c.open_cases} open</span>}</td>
                  {pack.shop && <td className="px-4 py-3">{c.returns}</td>}
                  <td className="px-4 py-3">{c.avg_rating !== null ? `${c.avg_rating} ★` : "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">{c.last_activity ? ago(c.last_activity) : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No {who} found{q ? `. Try a shorter search.` : "."}</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
