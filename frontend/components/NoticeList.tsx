"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Notice } from "@/lib/data/workspace";
import { ago } from "@/lib/format";
import { markAllRead, readOne } from "@/app/notifications-actions";
import { BellIcon, ChatIcon, HeadsetIcon, IdCardIcon, PackageIcon, RepeatIcon, ShieldIcon } from "./Icons";

const ICON: Record<string, { icon: React.ReactNode; tint: string }> = {
  new_escalation: { icon: <ShieldIcon className="h-4 w-4" />, tint: "bg-rose-50 text-rose-600" },
  customer_reply: { icon: <ChatIcon className="h-4 w-4" />, tint: "bg-indigo-50 text-indigo-600" },
  staff_reply: { icon: <HeadsetIcon className="h-4 w-4" />, tint: "bg-sky-50 text-sky-600" },
  case_update: { icon: <ChatIcon className="h-4 w-4" />, tint: "bg-violet-50 text-violet-600" },
  order_update: { icon: <PackageIcon className="h-4 w-4" />, tint: "bg-emerald-50 text-emerald-600" },
  return_request: { icon: <RepeatIcon className="h-4 w-4" />, tint: "bg-amber-50 text-amber-600" },
  return_update: { icon: <RepeatIcon className="h-4 w-4" />, tint: "bg-amber-50 text-amber-600" },
  new_request: { icon: <IdCardIcon className="h-4 w-4" />, tint: "bg-violet-50 text-violet-600" },
  request_update: { icon: <IdCardIcon className="h-4 w-4" />, tint: "bg-emerald-50 text-emerald-600" },
};

// Notifications. Each one stays "new" until the person opens it (or uses "Mark all as read").
// caseBase: where an alert about a case opens when it has no link of its own
// (staff: /cases/<id>, students and customers: /account/chats/<id>)
export default function NoticeList({ notices, caseBase = "/cases/" }: { notices: Notice[]; caseBase?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = notices.filter((n) => !n.read_at).length;

  if (notices.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500"><BellIcon className="h-6 w-6" /></span>
        <p className="font-semibold">You&apos;re all caught up</p>
        <p className="mt-1 text-sm text-slate-500">New updates will show here.</p>
      </div>
    );
  }
  const open = (n: Notice, href: string | null) => start(async () => {
    if (!n.read_at) await readOne(n.notification_id);
    if (href) router.push(href); else router.refresh();
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">{unread > 0 ? <><strong className="text-slate-900">{unread} new</strong> · open one to read it</> : "Everything is read"}</p>
        {unread > 0 && (
          <button type="button" disabled={pending} onClick={() => start(async () => { await markAllRead(); router.refresh(); })}
            className="rounded-lg px-3 py-1.5 font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">Mark all as read</button>
        )}
      </div>
      <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {notices.map((n) => {
          const ic = ICON[n.type] ?? ICON.case_update;
          const href = n.link ?? (n.case_id ? `${caseBase}${n.case_id}` : null);
          const isNew = !n.read_at;
          return (
            <li key={n.notification_id} className="border-b border-slate-100 last:border-0">
              <button type="button" onClick={() => open(n, href)} disabled={pending}
                className={`relative flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${isNew ? "bg-indigo-50/60" : ""}`}>
                {isNew && <span className="absolute inset-y-0 left-0 w-1 bg-indigo-600" aria-hidden="true" />}
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ic.tint}`}>{ic.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${isNew ? "font-semibold text-slate-900" : "text-slate-600"}`}>{n.title}</span>
                  <span className="block text-xs text-slate-500">{ago(n.created_at)}</span>
                </span>
                {isNew
                  ? <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">New</span>
                  : <span className="text-xs text-slate-400">Read</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
