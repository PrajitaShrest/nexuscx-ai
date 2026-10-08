"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, type FormState } from "@/app/auth/actions";
import Field, { inputClass } from "./Field";
import FormMessage from "./FormMessage";
import PasswordInput from "./PasswordInput";

const STAFF_ROLES = [
  { value: "support_agent", label: "Support Agent" },
  { value: "team_leader", label: "Team Leader" },
  { value: "knowledge_manager", label: "Knowledge Manager" },
  { value: "business_specialist", label: "Business Specialist" },
  { value: "administrator", label: "Administrator" },
];

// Demo shortcuts, like the prototype. They fill the username only; passwords are never stored here.
const DEMO: Record<"customer" | "staff", { label: string; username: string; role?: string }[]> = {
  customer: [{ label: "Alex (customer)", username: "alex.nguyen" }],
  staff: [
    { label: "Support Agent", username: "riley.support", role: "support_agent" },
    { label: "Team Leader", username: "jamie.lead", role: "team_leader" },
    { label: "Administrator", username: "avery.admin", role: "administrator" },
  ],
};

export default function LoginForm({ portal }: { portal: "customer" | "staff" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  const [identifier, setIdentifier] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const shownId = identifier ?? state.values?.identifier ?? "";
  const shownRole = role ?? state.values?.role ?? "";
  const err = (f: string) => (state.field === f ? state.error : undefined);
  const generalError = state.field ? undefined : state.error;

  return (
    <>
      <form action={action} className="space-y-5" noValidate>
        <input type="hidden" name="portal" value={portal} />
        {portal === "staff" && (
          <Field label="Signing in as" htmlFor="role" error={err("role")} hint="We check this against your account.">
            <select id="role" name="role" required value={shownRole} onChange={(e) => setRole(e.target.value)}
              className={inputClass(Boolean(err("role")))}>
              <option value="" disabled>Choose your role</option>
              {STAFF_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
        )}
        <Field label="Username or email" htmlFor="identifier" error={err("identifier")}>
          <input id="identifier" name="identifier" required autoComplete="username" autoFocus
            value={shownId} onChange={(e) => setIdentifier(e.target.value)}
            placeholder={portal === "staff" ? "riley.support" : "your username or email"}
            className={inputClass(Boolean(generalError || err("identifier")))} />
        </Field>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-sm font-semibold text-ink">Password</label>
            <Link href="/forgot-password" className="text-sm font-medium text-indigo-600 hover:underline">Forgot password?</Link>
          </div>
          <div className="mt-1.5">
            <PasswordInput id="password" name="password" autoComplete="current-password" invalid={Boolean(generalError || err("password"))} />
          </div>
          {err("password") && <p className="mt-1.5 text-sm text-bad">{err("password")}</p>}
        </div>
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" name="remember" defaultChecked={portal === "customer"}
            className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
          Keep me signed in for 30 days
        </label>
        <FormMessage error={generalError} ok={state.ok} />
        <button disabled={pending}
          className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Signing in…" : portal === "staff" ? "Sign in to staff portal" : "Sign in"}
        </button>
      </form>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <p className="text-sm text-muted">Demo accounts: tap one to fill in the details.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO[portal].map((d) => (
            <button key={d.username} type="button" onClick={() => { setIdentifier(d.username); if (d.role) setRole(d.role); }}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                shownId === d.username ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-300 text-ink hover:border-indigo-400"}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
