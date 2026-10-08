"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { logout } from "@/app/auth/actions";
import { setPresence } from "@/app/profile/actions";
import Avatar, { PRESENCE } from "./Avatar";
import { ChevronIcon, HomeIcon, KeyIcon, LogOutIcon, SettingsIcon, ChatIcon } from "./Icons";

export type MenuUser = { name: string; username: string; email: string; roles: string[]; staff: boolean; presence?: string };

// The account button in the top bar (customers) or sidebar (staff), with a menu:
// profile, home, change password, availability (staff) and log out.
export default function UserMenu({ user, dark, up }: { user: MenuUser; dark?: boolean; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const [presence, setLocal] = useState(user.presence ?? "online");
  const [, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const choose = (p: string) => { setLocal(p); start(() => { setPresence(p); }); };
  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink hover:bg-slate-100";

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}
        className={`flex w-full items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 text-left transition ${
          dark ? "rounded-xl hover:bg-white/10" : "border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm"}`}>
        <Avatar name={user.name} size={34} presence={user.staff ? presence : undefined} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-semibold ${dark ? "text-white" : "text-ink"}`}>{user.name}</span>
          <span className={`block truncate text-xs ${dark ? "text-slate-400" : "text-muted"}`}>{user.roles.join(" + ")}</span>
        </span>
        <ChevronIcon className={`h-4 w-4 shrink-0 transition ${dark ? "text-slate-400" : "text-muted"} ${open !== !!up ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className={`absolute z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 ${
          up ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"}`}>
          <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-4 text-white">
            <div className="flex items-center gap-3">
              <Avatar name={user.name} size={44} ring="ring-2 ring-white/60" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{user.name}</p>
                <p className="truncate text-xs text-indigo-100">@{user.username}</p>
                <p className="truncate text-xs text-indigo-100">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {user.roles.map((r) => <span key={r} className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">{r}</span>)}
            </div>
          </div>

          {user.staff && (
            <div className="border-b p-3">
              <p className="mb-2 px-1 text-xs font-semibold text-muted">My availability</p>
              <div className="grid grid-cols-3 gap-1">
                {["online", "busy", "away"].map((p) => (
                  <button key={p} type="button" onClick={() => choose(p)} aria-pressed={presence === p}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium ${
                      presence === p ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "text-muted hover:bg-slate-100"}`}>
                    <span className={`h-2 w-2 rounded-full ${PRESENCE[p].dot}`} />{PRESENCE[p].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-2">
            <Link href="/" role="menuitem" className={item} onClick={() => setOpen(false)}>
              {user.staff ? <HomeIcon className="h-4 w-4 text-muted" /> : <ChatIcon className="h-4 w-4 text-muted" />}
              {user.staff ? "My workspace" : "Help Centre"}
            </Link>
            <Link href="/profile" role="menuitem" className={item} onClick={() => setOpen(false)}>
              <SettingsIcon className="h-4 w-4 text-muted" /> Profile &amp; settings
            </Link>
            <Link href="/profile#security" role="menuitem" className={item} onClick={() => setOpen(false)}>
              <KeyIcon className="h-4 w-4 text-muted" /> Change password
            </Link>
          </div>
          <form action={logout} className="border-t p-2">
            <button role="menuitem" className={`${item} text-bad hover:bg-red-50`}>
              <LogOutIcon className="h-4 w-4" /> Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
