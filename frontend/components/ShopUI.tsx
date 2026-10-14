import type { ReactNode } from "react";
import { BoltIcon, CheckIcon, HeadphonesIcon, LampIcon, LaptopIcon, WatchIcon, XIcon } from "./Icons";

// Shared look for products and orders (customer and staff pages use the same badges).

export const CATEGORIES: Record<string, { label: string; tile: string; icon: (c: string) => ReactNode }> = {
  audio: { label: "Audio", tile: "from-indigo-500 to-violet-600", icon: (c) => <HeadphonesIcon className={c} /> },
  wearables: { label: "Wearables", tile: "from-emerald-400 to-teal-600", icon: (c) => <WatchIcon className={c} /> },
  computing: { label: "Computing", tile: "from-sky-400 to-indigo-600", icon: (c) => <LaptopIcon className={c} /> },
  home: { label: "Home", tile: "from-amber-400 to-orange-500", icon: (c) => <LampIcon className={c} /> },
  accessories: { label: "Accessories", tile: "from-fuchsia-500 to-pink-500", icon: (c) => <BoltIcon className={c} /> },
};

export function ProductTile({ category, size = "md" }: { category: string; size?: "sm" | "md" | "lg" }) {
  const c = CATEGORIES[category] ?? CATEGORIES.accessories;
  const box = size === "lg" ? "h-28 w-full rounded-2xl" : size === "md" ? "h-12 w-12 rounded-xl" : "h-9 w-9 rounded-lg";
  const ic = size === "lg" ? "h-12 w-12" : size === "md" ? "h-6 w-6" : "h-4.5 w-4.5";
  return (
    <span className={`flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-sm ${c.tile} ${box}`}>
      {c.icon(ic)}
    </span>
  );
}

export const ORDER_STATUS: Record<string, { label: string; style: string; step: number }> = {
  placed: { label: "Order placed", style: "bg-slate-100 text-slate-700 ring-slate-200", step: 1 },
  processing: { label: "Processing", style: "bg-amber-50 text-amber-800 ring-amber-200", step: 2 },
  shipped: { label: "On the way", style: "bg-sky-50 text-sky-700 ring-sky-200", step: 3 },
  delivered: { label: "Delivered", style: "bg-emerald-50 text-emerald-700 ring-emerald-200", step: 4 },
  cancelled: { label: "Cancelled", style: "bg-rose-50 text-rose-700 ring-rose-200", step: 0 },
};

export function OrderPill({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? ORDER_STATUS.placed;
  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${s.style}`}>{s.label}</span>;
}

const STEPS = ["Placed", "Processing", "On the way", "Delivered"];

// Four-step tracker. compact = a thin bar for lists.
export function OrderTracker({ status, compact }: { status: string; compact?: boolean }) {
  if (status === "cancelled") {
    return compact ? <div className="h-1.5 rounded-full bg-rose-100" aria-label="Cancelled" />
      : <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"><XIcon className="h-4 w-4" /> This order was cancelled. Any payment is refunded within 3 to 5 business days.</p>;
  }
  const step = ORDER_STATUS[status]?.step ?? 1;
  if (compact) {
    return (
      <div className="flex gap-1" aria-label={`Step ${step} of 4`}>
        {[1, 2, 3, 4].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? (step === 4 ? "bg-emerald-500" : "bg-indigo-500") : "bg-slate-200"}`} />)}
      </div>
    );
  }
  return (
    <ol className="grid grid-cols-4" aria-label="Order progress">
      {STEPS.map((label, i) => {
        const n = i + 1, done = n <= step, now = n === step && step < 4;
        return (
          <li key={label} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${done ? "bg-indigo-500" : "bg-slate-200"}`} />}
            <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
              done ? (step === 4 ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white") : "bg-slate-200 text-slate-500"} ${now ? "ring-4 ring-indigo-100" : ""}`}>
              {done && !now ? <CheckIcon className="h-4 w-4" /> : n}
            </span>
            <span className={`mt-2 text-xs sm:text-sm ${done ? "font-semibold text-ink" : "text-muted"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Customer-friendly words for support case status
export const CHAT_STATUS: Record<string, { label: string; style: string }> = {
  ai_handling: { label: "Answered by AI", style: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  escalated: { label: "With a specialist", style: "bg-amber-50 text-amber-800 ring-amber-200" },
  human_handling: { label: "Agent working on it", style: "bg-sky-50 text-sky-700 ring-sky-200" },
  waiting: { label: "Waiting for you", style: "bg-rose-50 text-rose-700 ring-rose-200" },
  resolved: { label: "Resolved", style: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  closed: { label: "Closed", style: "bg-slate-100 text-slate-600 ring-slate-200" },
};
export function ChatPill({ status }: { status: string }) {
  const s = CHAT_STATUS[status] ?? CHAT_STATUS.ai_handling;
  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${s.style}`}>{s.label}</span>;
}

// White card used across the customer portal
export function Panel({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">{icon}</span>
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:brightness-110 disabled:opacity-50 disabled:shadow-none";
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-50";

// ---------- returns & exchanges ----------
export const RETURN_REASONS: Record<string, string> = {
  damaged: "Arrived damaged", faulty: "Faulty or not working", wrong_item: "Wrong item sent",
  wrong_size: "Wrong size or colour", not_as_described: "Not as described", changed_mind: "Changed my mind",
};
export const RETURN_STATUS: Record<string, { label: string; style: string; step: number }> = {
  requested: { label: "Requested", style: "bg-slate-100 text-slate-700 ring-slate-200", step: 1 },
  approved: { label: "Approved", style: "bg-indigo-50 text-indigo-700 ring-indigo-200", step: 2 },
  received: { label: "Items received", style: "bg-sky-50 text-sky-700 ring-sky-200", step: 3 },
  completed: { label: "Completed", style: "bg-emerald-50 text-emerald-700 ring-emerald-200", step: 4 },
  rejected: { label: "Not accepted", style: "bg-rose-50 text-rose-700 ring-rose-200", step: 0 },
};
export function ReturnPill({ status }: { status: string }) {
  const s = RETURN_STATUS[status] ?? RETURN_STATUS.requested;
  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${s.style}`}>{s.label}</span>;
}
export function ReturnSteps({ status, kind }: { status: string; kind: string }) {
  if (status === "rejected") return null;
  const step = RETURN_STATUS[status]?.step ?? 1;
  const labels = ["Requested", "Approved", "Items received", kind === "exchange" ? "Replacement sent" : "Refunded"];
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs">
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-1">
          {i > 0 && <span className={`h-px w-4 ${i < step ? "bg-indigo-300" : "bg-slate-200"}`} />}
          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${i < step ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400"}`}>
            {i < step ? <CheckIcon className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          <span className={i < step ? "font-medium text-ink" : "text-muted"}>{l}</span>
        </li>
      ))}
    </ol>
  );
}
