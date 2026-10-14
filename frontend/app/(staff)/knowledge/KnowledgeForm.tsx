"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Field, { inputClass } from "@/components/Field";
import { changeStatus, saveDoc, type KbState } from "./actions";

const CATS = [["orders", "Orders & delivery"], ["billing", "Billing & refunds"], ["technical", "Technical"], ["account", "Account"], ["general", "General"]];

export function KnowledgeForm({ doc }: { doc?: { document_id: string; title: string; category: string; content: string; keywords: string; status: string } }) {
  const [state, action, pending] = useActionState<KbState, FormData>(saveDoc, {});
  const err = (f: string) => (state.field === f ? state.error : undefined);
  const [len, setLen] = useState(doc?.content.length ?? 0);
  return (
    <form action={action} noValidate className="space-y-4 rounded-xl border bg-white p-5">
      <input type="hidden" name="document_id" value={doc?.document_id ?? ""} />
      {doc?.status === "approved" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This article is live. Saving changes sends it back for review, and the AI stops using it until it is approved again.
        </p>
      )}
      <Field label="Title" htmlFor="title" error={err("title")} hint="Write it the way a customer would ask, e.g. “How do I track my parcel?”">
        <input id="title" name="title" defaultValue={doc?.title} required minLength={5} maxLength={150} className={inputClass(!!err("title"))} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="category" error={err("category")}>
          <select id="category" name="category" defaultValue={doc?.category ?? "general"} className={inputClass(!!err("category"))}>
            {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Keywords" htmlFor="keywords" error={err("keywords")} hint="Comma separated words customers use. Helps the AI find this article.">
          <input id="keywords" name="keywords" defaultValue={doc?.keywords} maxLength={300} placeholder="parcel, tracking, where is my order" className={inputClass(!!err("keywords"))} />
        </Field>
      </div>
      <Field label="Answer" htmlFor="content" error={err("content")} hint={`${len} / 8000 characters. Plain, friendly sentences. This is what the customer reads.`}>
        <textarea id="content" name="content" rows={10} defaultValue={doc?.content} required minLength={30} maxLength={8000}
          onChange={(e) => setLen(e.target.value.length)} className={inputClass(!!err("content"))} />
      </Field>
      {state.error && !state.field && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? "Saving…" : doc ? "Save changes" : "Save as draft"}</button>
        <Link href="/knowledge" className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</Link>
      </div>
    </form>
  );
}

// Buttons that move an article to the next step. The database decides what is allowed.
const NEXT: Record<string, { to: string; label: string; tone: string }[]> = {
  draft: [{ to: "under_review", label: "Send for review", tone: "primary" }, { to: "archived", label: "Archive", tone: "ghost" }],
  under_review: [{ to: "approved", label: "Approve", tone: "good" }, { to: "draft", label: "Send back to draft", tone: "ghost" }, { to: "archived", label: "Archive", tone: "ghost" }],
  approved: [{ to: "disabled", label: "Disable", tone: "bad" }, { to: "archived", label: "Archive", tone: "ghost" }],
  disabled: [{ to: "approved", label: "Re-enable", tone: "good" }, { to: "archived", label: "Archive", tone: "ghost" }],
  archived: [{ to: "draft", label: "Restore as draft", tone: "ghost" }],
};
const TONE: Record<string, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700", good: "bg-emerald-600 text-white hover:bg-emerald-700",
  bad: "bg-red-600 text-white hover:bg-red-700", ghost: "border text-gray-700 hover:bg-gray-50",
};

export function StatusButtons({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState<KbState, FormData>(changeStatus, {});
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(NEXT[status] ?? []).map((n) => (
          <form key={n.to} action={action}>
            <input type="hidden" name="document_id" value={id} />
            <input type="hidden" name="status" value={n.to} />
            <button disabled={pending} className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${TONE[n.tone]}`}>{n.label}</button>
          </form>
        ))}
      </div>
      <p aria-live="polite" className={`mt-2 text-sm ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error ?? state.ok}</p>
    </div>
  );
}
