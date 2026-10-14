"use client";

import { useActionState } from "react";
import type { AdminFormState } from "@/app/(staff)/admin-actions";

// A small form that calls a server action and shows "Saved" or the error beside its button.
export default function AdminForm({ action, children, className = "", button = "Save", compact }: {
  action: (p: AdminFormState, f: FormData) => Promise<AdminFormState>; children: React.ReactNode; className?: string; button?: string; compact?: boolean;
}) {
  const [state, run, pending] = useActionState<AdminFormState, FormData>(action, {});
  return (
    <form action={run} className={className}>
      {children}
      <div className={`flex items-center gap-3 ${compact ? "" : "mt-3"}`}>
        <button disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending ? "Saving…" : button}</button>
        <span aria-live="polite" className={`text-sm ${state.error ? "text-red-700" : "text-emerald-700"}`}>{state.error ?? state.ok}</span>
      </div>
    </form>
  );
}

