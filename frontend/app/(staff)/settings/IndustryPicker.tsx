"use client";

import { useActionState, useState } from "react";
import type { AdminFormState } from "@/app/(staff)/admin-actions";
import type { Industry, Pack } from "@/lib/packs";
import { CheckIcon, GradCapIcon, StoreIcon } from "@/components/Icons";

const ICON: Record<Industry, React.ReactNode> = {
  ecommerce: <StoreIcon className="h-6 w-6" />,
  university: <GradCapIcon className="h-6 w-6" />,
};
// Shown as "coming next" so the panel sees where the platform can go
const NEXT = ["Fast food", "Retail stores", "Internet & telco", "Banking & finance", "Hospitals"];

// Industry packs: pick which business the whole platform is set up for.
export default function IndustryPicker({ current, packs, action }: {
  current: Industry; packs: Pack[]; action: (p: AdminFormState, f: FormData) => Promise<AdminFormState>;
}) {
  const [picked, setPicked] = useState<Industry>(current);
  const [state, run, pending] = useActionState<AdminFormState, FormData>(action, {});
  return (
    <section id="industry" className="scroll-mt-6 rounded-xl border bg-white p-4">
      <h2 className="font-semibold">Default industry pack</h2>
      <p className="text-xs text-gray-500">
        One platform, set up for different businesses. Each pack has its own AI agents, knowledge base, routing, cases and wording.
        This is the pack everyone gets by default; changing it is saved in the audit log. Anyone can also try the other pack
        in their own browser with the E-commerce / University switch in the menu, without changing it for others.
      </p>
      <form action={run} className="mt-3">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Choose an industry pack</legend>
          {packs.map((p) => {
            const on = picked === p.id;
            return (
              <label key={p.id} className={`relative flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                on ? "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-200" : "border-gray-200 hover:border-indigo-300"}`}>
                <input type="radio" name="value" value={p.id} checked={on} onChange={() => setPicked(p.id)} className="sr-only" />
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${on ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>{ICON[p.id]}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold">
                    {p.label}
                    {current === p.id && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Default</span>}
                  </span>
                  <span className="block text-xs text-gray-500">{p.org}</span>
                  <span className="mt-1 block text-sm text-gray-600">{p.blurb}</span>
                </span>
                {on && <CheckIcon className="absolute right-3 top-3 h-4 w-4 text-indigo-600" />}
              </label>
            );
          })}
        </fieldset>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button disabled={pending || picked === current}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {pending ? "Saving…" : "Make default"}
          </button>
          <span aria-live="polite" className={`text-sm ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error ?? state.ok}</span>
        </div>
      </form>
      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
        Coming next:
        {NEXT.map((n) => <span key={n} className="rounded-full border border-dashed border-gray-300 px-2 py-0.5">{n}</span>)}
      </p>
    </section>
  );
}
