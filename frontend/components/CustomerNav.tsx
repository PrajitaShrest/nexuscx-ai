"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BellIcon, CartIcon, ChatIcon, ClockIcon, HomeIcon, MapPinIcon, PackageIcon, RepeatIcon, SettingsIcon } from "./Icons";

// Customer menu, laid out like the staff sidebar (same sections, same colours).
export const CUSTOMER_NAV: { section: string; items: { label: string; href: string; icon: (c: string) => ReactNode; exact?: boolean }[] }[] = [
  { section: "", items: [
    { label: "Overview", href: "/account", icon: (c) => <HomeIcon className={c} />, exact: true },
    { label: "Help & chat", href: "/support", icon: (c) => <ChatIcon className={c} /> },
  ]},
  { section: "Shopping", items: [
    { label: "Shop", href: "/shop", icon: (c) => <CartIcon className={c} /> },
    { label: "My orders", href: "/account/orders", icon: (c) => <PackageIcon className={c} /> },
    { label: "Returns & exchanges", href: "/account/returns", icon: (c) => <RepeatIcon className={c} /> },
  ]},
  { section: "Support", items: [
    { label: "Chat history", href: "/account/chats", icon: (c) => <ClockIcon className={c} /> },
  ]},
  { section: "My account", items: [
    { label: "Notifications", href: "/account/notifications", icon: (c) => <BellIcon className={c} /> },
    { label: "Addresses", href: "/account/addresses", icon: (c) => <MapPinIcon className={c} /> },
    { label: "Profile & security", href: "/profile", icon: (c) => <SettingsIcon className={c} /> },
  ]},
];

const isActive = (path: string, href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));

// The overview, shopping and addresses only exist in the e-commerce pack (other packs start at Help & chat)
const SHOP_ONLY = new Set(["/account", "/shop", "/account/orders", "/account/returns", "/account/addresses"]);
const navFor = (shop: boolean) =>
  CUSTOMER_NAV.map((g) => ({ ...g, items: g.items.filter((i) => shop || !SHOP_ONLY.has(i.href)) })).filter((g) => g.items.length > 0);

export function SideLinks({ unread = 0, shop = true }: { unread?: number; shop?: boolean }) {
  const path = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
      {navFor(shop).map((g) => (
        <div key={g.section || "main"}>
          {g.section && <p className="px-2 pb-1 text-xs font-semibold text-slate-500">{g.section}</p>}
          {g.items.map((i) => {
            const on = isActive(path, i.href, i.exact);
            return (
              <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm ${on ? "bg-indigo-600 text-white" : "hover:bg-white/5"}`}>
                {i.icon("h-4 w-4")}<span className="flex-1">{i.label}</span>
                {i.href === "/account/notifications" && unread > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">{unread}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// Phone and tablet: a scrollable row of tabs under the top bar
export function TopTabs({ unread = 0, shop = true }: { unread?: number; shop?: boolean }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Account menu">
      {navFor(shop).flatMap((g) => g.items).map((i) => {
        const on = isActive(path, i.href, i.exact);
        return (
          <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${on ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}>
            {i.icon("h-3.5 w-3.5")}{i.label}
            {i.href === "/account/notifications" && unread > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">{unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
