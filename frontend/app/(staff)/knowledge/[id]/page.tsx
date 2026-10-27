import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NoAccess from "@/components/NoAccess";
import { Pill } from "@/components/Badges";
import { can, getMe } from "@/lib/data/me";
import { getKnowledgeDoc } from "@/lib/data/knowledge";
import { dayTime } from "@/lib/format";
import { KnowledgeForm, StatusButtons } from "../KnowledgeForm";
import { KB_STATUS } from "../StatusPill";
import { getIndustry } from "@/lib/industry";
import { KB_CATS } from "@/lib/packs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Knowledge article" };

// /knowledge/new creates an article; /knowledge/<id> edits one and moves it through review.
export default async function KnowledgeDocPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!can(me, "manage_knowledge")) return <NoAccess me={me} page="Knowledge Base" needs="manage_knowledge" />;
  const { id } = await params;
  const isNew = id === "new";
  const [doc, industry] = await Promise.all([isNew ? null : getKnowledgeDoc(id), getIndustry()]);
  if (!isNew && !doc) notFound();

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 text-gray-900">
      <Sidebar me={me} active="/knowledge" />
      <main className="min-w-0 flex-1 p-6">
        <Link href="/knowledge" className="text-sm text-indigo-700 hover:underline">← Knowledge Base</Link>
        <div className="mt-2 mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{doc ? doc.title : "New article"}</h1>
          {doc && <Pill map={KB_STATUS} value={doc.status} />}
          {doc && <span className="text-sm text-gray-500">{doc.version}</span>}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2"><KnowledgeForm doc={doc ?? undefined} cats={KB_CATS[industry]} /></div>
          {doc && (
            <aside className="space-y-4">
              <section className="rounded-xl border bg-white p-4">
                <h2 className="mb-3 font-semibold">Review</h2>
                <StatusButtons id={doc.document_id} status={doc.status} />
              </section>
              <section className="rounded-xl border bg-white p-4 text-sm">
                <h2 className="mb-2 font-semibold">History</h2>
                <dl className="space-y-1.5">
                  <div className="flex justify-between gap-2"><dt className="text-gray-500">Written by</dt><dd>{doc.created_by_name ?? "Seed data"}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-gray-500">Last edit</dt><dd>{doc.updated_by_name ?? "—"} · {dayTime(doc.updated_at)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-gray-500">Approved by</dt><dd>{doc.approved_by_name ?? "—"}{doc.approved_at ? ` · ${dayTime(doc.approved_at)}` : ""}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-gray-500">AI answers (30 days)</dt><dd>{doc.uses_30d}</dd></div>
                </dl>
                <p className="mt-3 text-xs text-gray-400">Every change is saved in the audit log.</p>
              </section>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
