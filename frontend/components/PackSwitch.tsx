"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { choosePack } from "@/app/pack-actions";
import { GradCapIcon, StoreIcon } from "./Icons";
import type { Industry } from "@/lib/packs";

// Two-button switch: E-commerce demo / University demo.
// The choice is saved in this browser only, so other people are not affected.
const OPTIONS: { id: Industry; label: string; short: string; org: string; icon: (c: string) => React.ReactNode }[] = [
  { id: "ecommerce", label: "E-commerce", short: "Store", org: "NexusCX Store", icon: (c) => <StoreIcon className={c} /> },
  { id: "university", label: "University", short: "Uni", org: "Northbridge University", icon: (c) => <GradCapIcon className={c} /> },
];

// Pages that only exist in one pack: switching sends you to the right home page
const SHOP_ONLY = ["/shop", "/account/orders", "/account/returns", "/account/addresses", "/orders", "/returns"];

export default function PackSwitch({ current, tone = "light", short = false, size = "md", block = false }: {
  current: Industry; tone?: "light" | "dark"; short?: boolean; size?: "md" | "lg"; block?: boolean; // block = full width (menus)
}) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const dark = tone === "dark";
  const pick = (id: Industry) => {
    if (id === current || pending) return;
    start(async () => {
      await choosePack(id);
      if (id !== "ecommerce" && SHOP_ONLY.some((p) => path === p || path.startsWith(`${p}/`))) {
        router.push(path.startsWith("/account") || path === "/shop" ? "/support" : "/dashboard");
      } else if (id !== "ecommerce" && path === "/account") {
        router.push("/support");
      }
      router.refresh();
    });
  };
  // Large version for the sign-in pages: two big cards
  if (size === "lg") {
    return (
      <div role="radiogroup" aria-label="Choose a demo" aria-busy={pending} className={`grid grid-cols-2 gap-3 ${pending ? "opacity-60" : ""}`}>
        {OPTIONS.map((o) => {
          const on = o.id === current;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => pick(o.id)} disabled={pending}
              className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition ${on
                ? "border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100"
                : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-sm"}`}>
              <span className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:flex ${on ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                {o.icon("h-6 w-6")}
              </span>
              <span className="min-w-0">
                <span className={`block whitespace-nowrap text-base font-bold ${on ? "text-indigo-700" : "text-ink"}`}>{o.label}</span>
                <span className="block text-xs leading-tight text-muted">{o.org}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div role="radiogroup" aria-label="Demo industry" aria-busy={pending}
      className={`${block ? "grid w-full grid-cols-2" : "inline-flex"} rounded-full p-1 text-sm font-semibold ${dark ? "bg-white/10 ring-1 ring-white/15" : "bg-slate-100 ring-1 ring-slate-200"} ${pending ? "opacity-60" : ""}`}>
      {OPTIONS.map((o) => {
        const on = o.id === current;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => pick(o.id)} disabled={pending}
            className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 transition ${block ? "whitespace-nowrap px-1 text-xs" : "px-3"} ${on
              ? (dark ? "bg-white text-indigo-700 shadow" : "bg-white text-indigo-700 shadow-sm")
              : (dark ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-ink")}`}>
            {o.icon("h-4 w-4")}{short ? o.short : o.label}
          </button>
        );
      })}
    </div>
  );
}
