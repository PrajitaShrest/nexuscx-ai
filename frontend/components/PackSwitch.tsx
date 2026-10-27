"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { choosePack } from "@/app/pack-actions";
import { GradCapIcon, StoreIcon } from "./Icons";
import type { Industry } from "@/lib/packs";

// Two-button switch: E-commerce demo / University demo.
// The choice is saved in this browser only, so other people are not affected.
const OPTIONS: { id: Industry; label: string; short: string; icon: React.ReactNode }[] = [
  { id: "ecommerce", label: "E-commerce", short: "Store", icon: <StoreIcon className="h-3.5 w-3.5" /> },
  { id: "university", label: "University", short: "Uni", icon: <GradCapIcon className="h-3.5 w-3.5" /> },
];

// Pages that only exist in one pack: switching sends you to the right home page
const SHOP_ONLY = ["/shop", "/account/orders", "/account/returns", "/account/addresses", "/orders", "/returns"];

export default function PackSwitch({ current, tone = "light", short = false }: { current: Industry; tone?: "light" | "dark"; short?: boolean }) {
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
  return (
    <div role="radiogroup" aria-label="Demo industry" aria-busy={pending}
      className={`inline-flex rounded-full p-0.5 text-xs font-semibold ${dark ? "bg-white/10 ring-1 ring-white/10" : "bg-slate-100 ring-1 ring-slate-200"} ${pending ? "opacity-60" : ""}`}>
      {OPTIONS.map((o) => {
        const on = o.id === current;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => pick(o.id)} disabled={pending}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition ${on
              ? (dark ? "bg-white text-indigo-700 shadow" : "bg-white text-indigo-700 shadow-sm")
              : (dark ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-ink")}`}>
            {o.icon}{short ? o.short : o.label}
          </button>
        );
      })}
    </div>
  );
}
