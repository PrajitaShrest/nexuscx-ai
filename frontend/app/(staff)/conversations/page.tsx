import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import { can } from "@/lib/data/me";
import { CATEGORY, STATUS, Pill, initials } from "@/components/Badges";
import { getMe } from "@/lib/data/me";
import { listCaseQueue } from "@/lib/data/cases";

const TABS = [
  { label: "All", value: "" },
  { label: "AI Handling", value: "ai_handling" },
  { label: "Human Handling", value: "human_handling" },
  { label: "Escalated", value: "escalated" },
  { label: "Resolved", value: "resolved" },
];

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await getMe();
  if (!can(me, "view_cases")) return <NoAccess me={me} page="Conversations" needs="view_cases" />;
  const { tab = "" } = await searchParams;
  const { data: cases, error } = await listCaseQueue();
  const shown = cases.filter((c) => !tab || c.status === tab);

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/conversations" />
      <main className="flex-1">
        <header className="flex items-center justify-between border-b bg-white px-6 py-4">
          <h1 className="text-xl font-semibold">Conversations</h1>
          <span className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-sm text-green-700">● AI Systems Online</span>
        </header>
        <div className="mx-auto max-w-3xl p-6">
          <div className="mb-4 flex gap-4 border-b">
            {TABS.map((t) => (
              <Link key={t.label} href={t.value ? `/conversations?tab=${t.value}` : "/conversations"}
                className={`pb-2 text-sm ${tab === t.value ? "border-b-2 border-indigo-600 font-semibold text-indigo-600" : "text-gray-500"}`}>
                {t.label}
              </Link>
            ))}
          </div>
          {error && <p className="rounded-md bg-red-50 p-3 text-red-700">{error}</p>}
          {!error && shown.length === 0 && <p className="text-gray-500">No cases here.</p>}
          <ul className="divide-y rounded-lg border bg-white">
            {shown.map((c) => (
              <li key={c.case_id} className="flex gap-4 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-500 text-sm font-semibold text-white">
                  {initials(c.customer_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between">
                    <p className="font-semibold">{c.customer_name} <span className="ml-2 text-xs font-normal text-gray-400">{c.case_number}</span></p>
                    <p className="text-sm text-gray-500">{new Date(c.created_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <p className="truncate text-sm text-gray-600">{c.subject ?? "(no message yet)"}</p>
                  <div className="mt-2 flex justify-between">
                    <span className="flex items-center gap-2">
                      <Pill map={CATEGORY} value={c.intent} />
                      {c.assigned_to && <span className="text-xs text-gray-500">→ {c.assigned_to}</span>}
                    </span>
                    <Pill map={STATUS} value={c.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-400">{cases.length} cases loaded live from Supabase as {me.name}</p>
        </div>
      </main>
    </div>
  );
}
