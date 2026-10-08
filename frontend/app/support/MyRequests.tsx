"use client";

import { useState } from "react";
import { CUSTOMER_STATUS, topicForIntent } from "./topics";
import { InboxIcon } from "@/components/Icons";

export type RequestCard = { id: string; number: string; subject: string; intent: string | null; status: string; ago: string };

export default function MyRequests({ items }: { items: RequestCard[] }) {
  const [tab, setTab] = useState<"open" | "done" | "all">("open");
  const [more, setMore] = useState(false);
  const isDone = (s: string) => s === "resolved" || s === "closed";
  const list = items.filter((c) => tab === "all" || (tab === "done" ? isDone(c.status) : !isDone(c.status)));
  const shown = more ? list : list.slice(0, 5);
  const count = { open: items.filter((c) => !isDone(c.status)).length, done: items.filter((c) => isDone(c.status)).length, all: items.length };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-ink">My requests</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-muted">{items.length}</span>
      </div>
      <div className="mb-4 grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-sm" role="tablist">
        {(["open", "done", "all"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setMore(false); }}
            className={`rounded-lg py-1.5 font-medium transition ${tab === t ? "bg-white text-indigo-700 shadow-sm" : "text-muted hover:text-ink"}`}>
            {t === "open" ? "Open" : t === "done" ? "Resolved" : "All"} <span className="text-xs opacity-60">{count[t]}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500"><InboxIcon className="h-6 w-6" /></span>
          <p className="font-medium text-ink">{tab === "done" ? "Nothing resolved yet" : "No open requests"}</p>
          <p className="mt-1 text-sm text-muted">{tab === "done" ? "Resolved requests will show here." : "Ask us anything in the chat."}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((c) => {
            const t = topicForIntent(c.intent);
            const s = CUSTOMER_STATUS[c.status] ?? CUSTOMER_STATUS.ai_handling;
            return (
              <li key={c.id} className="rounded-2xl border border-slate-200 p-3.5 transition hover:border-indigo-300 hover:shadow-md">
                <div className="flex gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 [&>svg]:h-5 [&>svg]:w-5 ${t.tint}`}>{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink" title={c.subject}>{c.subject}</p>
                    <p className="text-xs text-muted">{c.number} · {c.ago}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex flex-1 gap-1" aria-hidden="true">
                    {[1, 2, 3].map((n) => (
                      <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= s.step ? (s.step === 3 ? "bg-emerald-500" : c.status === "ai_handling" ? "bg-indigo-500" : "bg-amber-400") : "bg-slate-200"}`} />
                    ))}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${s.style}`}>{s.label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > 5 && (
        <button onClick={() => setMore(!more)} className="mt-3 w-full rounded-xl py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
          {more ? "Show less" : `Show all ${list.length}`}
        </button>
      )}
    </section>
  );
}
