import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import FilterBar from "@/components/FilterBar";
import { BookIcon, PlusIcon } from "@/components/Icons";
import { can, getMe } from "@/lib/data/me";
import { getKnowledgeGaps, getUnhelpfulArticles } from "@/lib/data/ops";
import { getPack } from "@/lib/industry";
import { categoryForIntent, kbLabel } from "@/lib/packs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Knowledge gaps" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Questions the AI could not answer, grouped by topic. Staff turn a gap into
// a DRAFT article; a second person approves it before the AI may use it.
// Once an article is approved, its questions drop off this list by themselves.
export default async function KnowledgeGapsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const me = await getMe();
  if (!can(me, "manage_knowledge")) return <NoAccess me={me} page="Knowledge gaps" needs="manage_knowledge" />;
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const [{ data, error }, pack, { data: unhelpful }] = await Promise.all([getKnowledgeGaps(days), getPack(), getUnhelpfulArticles(days)]);
  const groups = data?.groups ?? [];
  const covered = groups.reduce((a, g) => a + g.count, 0);

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/knowledge/gaps" />
      <main className="min-w-0 flex-1 space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/knowledge" className="text-sm text-indigo-700 hover:underline">← Knowledge Base</Link>
            <h1 className="mt-1 text-xl font-semibold">Knowledge gaps</h1>
            <p className="text-sm text-gray-500">
              What {pack.people.toLowerCase()} asked that the AI could not answer, so a person had to, and answers they said did not help. Write an article once, and the AI can answer it next time.
            </p>
          </div>
          <FilterBar filters={[{ name: "days", label: "Period", options: [7, 30, 90].map((d) => [String(d), `Last ${d} days`] as [string, string]) }]} />
        </div>
        {error && <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{error} Migration 019 must be run in Supabase.</p>}

        {data && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[["Unanswered questions", data.unanswered], ["Topics found", groups.length], ["Questions an article would cover", covered]].map(([k, v]) => (
              <div key={k} className="rounded-xl border bg-white px-4 py-3"><p className="text-xs text-gray-500">{k}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
            ))}
          </div>
        )}

        {data && groups.length === 0 && (
          <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
            No gaps in the last {days} days. Every question had an approved article. 🎉
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {groups.map((g) => {
            const cat = categoryForIntent(g.intent, pack.id);
            const draft = new URLSearchParams({ title: `${cap(g.topic)}: ${g.questions[0] ?? ""}`.slice(0, 150), category: cat, keywords: g.topic, from: "gaps" });
            return (
              <section key={g.topic} className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><BookIcon className="h-5 w-5" /></span>
                    <div>
                      <h2 className="font-semibold">{cap(g.topic)}</h2>
                      <p className="text-xs text-gray-500">{g.count} question{g.count === 1 ? "" : "s"} · suggested category: {kbLabel(cat)}</p>
                    </div>
                  </div>
                  <Link href={`/knowledge/new?${draft}`} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">
                    <PlusIcon className="h-4 w-4" /> Draft an article
                  </Link>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {g.questions.map((q) => <li key={q} className="rounded-lg bg-gray-50 px-3 py-2 text-gray-700">“{q}”</li>)}
                </ul>
                <p className="mt-2 text-xs text-gray-500">Cases: {g.cases.join(", ")}</p>
              </section>
            );
          })}
        </div>

        {unhelpful.length > 0 && (
          <section className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">Answers people said did not help</h2>
            <p className="mb-3 text-xs text-gray-500">From the &ldquo;Did this answer your question?&rdquo; buttons. Improve these articles so fewer questions need a person.</p>
            <ul className="divide-y text-sm">
              {unhelpful.map((a) => (
                <li key={a.document_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-gray-500">👎 {a.not_helpful} · 👍 {a.helpful}{a.questions?.length ? ` · e.g. “${a.questions[0]}”` : ""}</p>
                  </div>
                  <Link href={`/knowledge/${a.document_id}`} className="rounded-lg border px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Improve article</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-gray-500">
          The AI never writes or approves articles itself. A draft must be approved by a second person before the AI may use it.
        </p>
      </main>
    </div>
  );
}
