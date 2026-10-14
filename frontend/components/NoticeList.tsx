"use client";

import Link from "next/link";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Notice } from "@/lib/data/workspace";
import { ago } from "@/lib/format";
import { markAllRead } from "@/app/notifications-actions";
import { BellIcon, ChatIcon, HeadsetIcon, PackageIcon, RepeatIcon, ShieldIcon } from "./Icons";

const ICON: Record<string, { icon: React.ReactNode; tint: string }> = {
  new_escalation: { icon: <ShieldIcon className="h-4 w-4" />, tint: "bg-rose-50 text-rose-600" },
  customer_reply: { icon: <ChatIcon className="h-4 w-4" />, tint: "bg-indigo-50 text-indigo-600" },
  staff_reply: { icon: <HeadsetIcon className="h-4 w-4" />, tint: "bg-sky-50 text-sky-600" },
  case_update: { icon: <ChatIcon className="h-4 w-4" />, tint: "bg-violet-50 text-violet-600" },
  order_update: { icon: <PackageIcon className="h-4 w-4" />, tint: "bg-emerald-50 text-emerald-600" },
  return_request: { icon: <RepeatIcon className="h-4 w-4" />, tint: "bg-amber-50 text-amber-600" },
  return_update: { icon: <RepeatIcon className="h-4 w-4" />, tint: "bg-amber-50 text-amber-600" },
};

// Shows notifications and marks them read once the page has been seen.
export default function NoticeList({ notices }: { notices: Notice[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const unread = notices.filter((n) => !n.read_at).length;
  useEffect(() => {
    if (unread === 0) return;
    const t = setTimeout(() => start(async () => { await markAllRead(); router.refresh(); }), 1500);
    return () => clearTimeout(t);
  }, [unread, router]);

  if (notices.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500"><BellIcon className="h-6 w-6" /></span>
        <p className="font-semibold">You&apos;re all caught up</p>
        <p className="mt-1 text-sm text-slate-500">New updates will show here.</p>
      </div>
    );
  }
  return (
    <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {notices.map((n) => {
        const ic = ICON[n.type] ?? ICON.case_update;
        const body = (
          <span className="flex items-center gap-3 px-4 py-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ic.tint}`}>{ic.icon}</span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm ${n.read_at ? "text-slate-600" : "font-semibold text-slate-900"}`}>{n.title}</span>
              <span className="block text-xs text-slate-500">{ago(n.created_at)}</span>
            </span>
            {!n.read_at && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-600" aria-label="Unread" />}
          </span>
        );
        return (
          <li key={n.notification_id} className={`border-b border-slate-100 last:border-0 ${n.read_at ? "" : "bg-indigo-50/40"}`}>
            {n.link ? <Link href={n.link} className="block hover:bg-slate-50">{body}</Link> : body}
          </li>
        );
      })}
    </ul>
  );
}
