"use client";

import Link from "next/link";
import { useState } from "react";
import type { Chat } from "@/lib/data/shop";
import { ago } from "@/lib/format";
import { ChatPill, EmptyState, btnPrimary } from "@/components/ShopUI";
import { BotIcon, ChatIcon, HeadsetIcon, PackageIcon, SearchIcon, UserIcon } from "@/components/Icons";

const WHO: Record<string, string> = { customer: "You", ai_agent: "Assistant", human_agent: "Support team", system: "NexusCX" };

export default function ChatList({ chats }: { chats: Chat[] }) {
  const [tab, setTab] = useState<"open" | "done" | "all">("all");
  const [q, setQ] = useState("");
  const done = (s: string) => s === "resolved" || s === "closed";
  const shown = chats.filter((c) => (tab === "all" || (tab === "done" ? done(c.status) : !done(c.status)))
    && `${c.subject} ${c.case_number} ${c.order?.order_number ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));

  if (chats.length === 0) {
    return <EmptyState icon={<ChatIcon className="h-6 w-6" />} title="No chats yet" text="When you ask us something, the whole conversation is kept here."
      action={<Link href="/support" className={btnPrimary}>Ask a question</Link>} />;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm" role="tablist">
          {(["all", "open", "done"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`rounded-lg px-3.5 py-1.5 font-medium ${tab === t ? "bg-white text-indigo-700 shadow-sm" : "text-muted hover:text-ink"}`}>
              {t === "all" ? "All" : t === "open" ? "Open" : "Resolved"}
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search chats</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by topic, case or order number"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
        </label>
      </div>
      <ul className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {shown.length === 0 && <li className="p-8 text-center text-sm text-muted">No chats match.</li>}
        {shown.map((c) => {
          const by = c.last?.sender_type ?? "customer";
          return (
            <li key={c.case_id} className="border-b border-slate-100 last:border-0">
              <Link href={`/account/chats/${c.case_id}`} className="flex gap-4 p-4 hover:bg-slate-50 sm:p-5">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${by === "human_agent" ? "bg-sky-100 text-sky-700" : by === "customer" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}>
                  {by === "human_agent" ? <HeadsetIcon className="h-5 w-5" /> : by === "customer" ? <UserIcon className="h-5 w-5" /> : <BotIcon className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate font-semibold">{c.subject?.replace(/^About my order [A-Z0-9-]+: /, "") ?? "Support request"}</span>
                    <ChatPill status={c.status} />
                  </span>
                  {c.last && <span className="mt-1 line-clamp-1 block text-sm text-muted"><span className="font-medium text-ink">{WHO[by]}:</span> {c.last.content}</span>}
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span>{c.case_number}</span><span>{c.count} message{c.count === 1 ? "" : "s"}</span><span>{ago(c.last?.sent_at ?? c.created_at)}</span>
                    {c.order && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700"><PackageIcon className="h-3 w-3" />{c.order.order_number}</span>}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
