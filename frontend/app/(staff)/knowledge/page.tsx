import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import { Pill } from "@/components/Badges";
import { PlusIcon } from "@/components/Icons";
import { can, getMe } from "@/lib/data/me";
import { listKnowledge } from "@/lib/data/knowledge";
import { ago } from "@/lib/format";
import { KB_STATUS } from "./StatusPill";
import { getIndustry } from "@/lib/industry";
import { KB_CATS, kbLabel } from "@/lib/packs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Knowledge Base" };

const TABS = [["all", "All"], ["approved", "Live"], ["under_review", "In review"], ["draft", "Drafts"], ["disabled", "Disabled"], ["archived", "Archived"]];

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ tab?: string; cat?: string }> }) {
  const me = await getMe();
  if (!can(me, "manage_knowledge")) return <NoAccess me={me} page="Knowledge Base" needs="manage_knowledge" />;
  const { tab = "all", cat = "" } = await searchParams;
  const [{ data: all, error }, industry] = await Promise.all([listKnowledge(), getIndustry()]);
  const count = (s: string) => (s === "all" ? all.length : all.filter((d) => d.status === s).length);
  const rows = all.filter((d) => (tab === "all" || d.status === tab) && (!cat || d.category === cat));
  const qs = (t: string, c: string) => `/knowledge?tab=${t}${c ? `&cat=${c}` : ""}`;

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/knowledge" />
      <main className="min-w-0 flex-1 p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Knowledge Base</h1>
            <p className="text-sm text-gray-500">The AI only answers from <strong>approved</strong> articles. New and edited articles need a second person to approve them.</p>
          </div>
          <Link href="/knowledge/new" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><PlusIcon className="h-4 w-4" /> New article</Link>
        </div>
        <nav aria-label="Status" className="mb-3 flex flex-wrap gap-2">
          {TABS.map(([t, l]) => (
            <Link key={t} href={qs(t, cat)} aria-current={tab === t ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-sm ${tab === t ? "bg-indigo-600 text-white" : "border bg-white text-gray-700 hover:bg-gray-50"}`}>
              {l} <span className="opacity-70">{count(t)}</span>
            </Link>
          ))}
        </nav>
        <nav aria-label="Category" className="mb-4 flex flex-wrap gap-2 text-xs">
          <Link href={qs(tab, "")} className={`rounded px-2 py-1 ${!cat ? "bg-gray-800 text-white" : "bg-white text-gray-600 border"}`}>All topics</Link>
          {KB_CATS[industry].map(([c, l]) => (
            <Link key={c} href={qs(tab, c)} className={`rounded px-2 py-1 ${cat === c ? "bg-gray-800 text-white" : "bg-white text-gray-600 border"}`}>{l}</Link>
          ))}
        </nav>
        {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>{["Article", "Topic", "Status", "Version", "Used (30 days)", "Last change"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((d) => (
                <tr key={d.document_id} className="hover:bg-indigo-50/40">
                  <td className="px-4 py-3"><Link href={`/knowledge/${d.document_id}`} className="font-medium text-indigo-700 hover:underline">{d.title}</Link>
                    {d.keywords && <p className="max-w-md truncate text-xs text-gray-500">{d.keywords}</p>}</td>
                  <td className="whitespace-nowrap px-4 py-3">{kbLabel(d.category)}</td>
                  <td className="px-4 py-3"><span className="whitespace-nowrap"><Pill map={KB_STATUS} value={d.status} /></span></td>
                  <td className="px-4 py-3">{d.version}</td>
                  <td className="px-4 py-3">{d.uses_30d}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">{ago(d.updated_at)}{d.updated_by_name ? ` · ${d.updated_by_name}` : ""}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No articles here.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
