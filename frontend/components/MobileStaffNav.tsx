"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "./Logo";
import UserMenu, { type MenuUser } from "./UserMenu";
import { XIcon } from "./Icons";

type Group = { section: string; items: { label: string; href?: string; week?: number; badge?: number }[] };

// Staff navigation for phones and small tablets: a top bar with a menu button
// that opens the same menu as the desktop sidebar in a slide-out panel.
export default function MobileStaffNav({ groups, active, user }: { groups: Group[]; active: string; user: MenuUser }) {
  const [open, setOpen] = useState(false);
  const current = groups.flatMap((g) => g.items).find((i) => i.href && active.startsWith(i.href))?.label;

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="sticky top-0 z-30 md:hidden">
      <div className="flex items-center gap-3 bg-navy px-4 py-3 text-white">
        <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="staff-menu" aria-label="Open menu"
          className="-ml-1 rounded-md p-1.5 hover:bg-white/10">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <Logo tone="light" size={26} />
        {current && <span className="ml-auto truncate text-sm text-slate-300">{current}</span>}
      </div>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav id="staff-menu" className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-navy text-slate-300 shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <Logo tone="light" size={30} />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-md p-1.5 hover:bg-white/10"><XIcon className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
              {groups.map((g) => (
                <div key={g.section || "main"}>
                  {g.section && <p className="px-2 pb-1 text-xs font-semibold text-slate-500">{g.section}</p>}
                  {g.items.map((item) => item.href ? (
                    <Link key={item.label} href={item.href} onClick={() => setOpen(false)} aria-current={active.startsWith(item.href) ? "page" : undefined}
                      className={`flex items-center justify-between rounded-md px-2 py-2.5 text-sm ${active.startsWith(item.href) ? "bg-indigo-600 text-white" : "hover:bg-white/5"}`}>
                      {item.label}
                      {!!item.badge && <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">{item.badge > 99 ? "99+" : item.badge}</span>}
                    </Link>
                  ) : (
                    <p key={item.label} className="px-2 py-2.5 text-sm text-slate-500">{item.label} <span className="text-[11px]">Wk {item.week}</span></p>
                  ))}
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 p-3"><UserMenu user={user} dark up /></div>
          </nav>
        </div>
      )}
    </div>
  );
}
