"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import Field, { inputClass } from "@/components/Field";
import PasswordInput from "@/components/PasswordInput";
import StrengthMeter from "@/components/StrengthMeter";
import { checkUsername } from "@/app/auth/actions";
import { changePassword, saveProfile, type ProfileState } from "./actions";

const empty: ProfileState = {};
const btn = "rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:brightness-110 disabled:opacity-60";
const ghost = "rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50";

export type DetailsInit = {
  name: string; username: string; email: string; customer: boolean;
  phone: string; address: string; dob: string;
};

export function DetailsForm({ init }: { init: DetailsInit }) {
  const [state, action, pending] = useActionState(saveProfile, empty);
  const [v, setV] = useState(init);
  const [check, setCheck] = useState<{ name: string; result: "available" | "taken" | "invalid" } | null>(null);
  const same = v.username.toLowerCase() === init.username.toLowerCase();
  const userCheck = same ? "" : check?.name === v.username ? check.result : "checking";
  const set = (k: keyof DetailsInit) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const changed = (Object.keys(init) as (keyof DetailsInit)[]).some((k) => v[k] !== init[k]);

  // Live username check, only when it differs from the current one
  useEffect(() => {
    if (same) return;
    const name = v.username;
    const t = setTimeout(async () => setCheck({ name, result: await checkUsername(name) }), 450);
    return () => clearTimeout(t);
  }, [v.username, same]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!changed) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);

  const err = (f: string) => (state.field === f ? state.error : undefined);
  const userHint = userCheck === "checking" ? "Checking…" : userCheck === "available" ? "✓ Available"
    : userCheck === "taken" ? "That username is taken." : userCheck === "invalid" ? "Use 3–30 letters, numbers, dots or underscores." : "You can sign in with this or your email.";

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="name" error={err("name")}>
          <input id="name" name="name" value={v.name} onChange={set("name")} required minLength={2} maxLength={100}
            autoComplete="name" className={inputClass(!!err("name"))} />
        </Field>
        <Field label="Username" htmlFor="username" error={err("username") ?? (userCheck === "taken" || userCheck === "invalid" ? userHint : undefined)}
          hint={userCheck === "taken" || userCheck === "invalid" ? undefined : userHint}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">@</span>
            <input id="username" name="username" value={v.username} onChange={set("username")} required autoComplete="username"
              className={`${inputClass(!!err("username") || userCheck === "taken" || userCheck === "invalid")} pl-8`} />
          </div>
        </Field>
        <Field label="Email" htmlFor="email" hint="Contact support if you need to change your email.">
          <input id="email" value={v.email} disabled className={`${inputClass()} cursor-not-allowed bg-slate-50 text-muted`} />
        </Field>
        {init.customer && (
          <>
            <Field label="Mobile number" htmlFor="phone" error={err("phone")} hint="Optional. Australian mobile, like 0412 345 678.">
              <input id="phone" name="phone" type="tel" value={v.phone} onChange={set("phone")} autoComplete="tel"
                placeholder="0412 345 678" className={inputClass(!!err("phone"))} />
            </Field>
            <Field label="Date of birth" htmlFor="date_of_birth" error={err("date_of_birth")}>
              <input id="date_of_birth" name="date_of_birth" type="date" value={v.dob} onChange={set("dob")}
                max={new Date().toISOString().slice(0, 10)} className={inputClass(!!err("date_of_birth"))} />
            </Field>
            <Field label="Delivery address" htmlFor="address" hint="Optional. Used for your orders.">
              <input id="address" name="address" value={v.address} onChange={set("address")} maxLength={255}
                autoComplete="street-address" placeholder="12 Example St, Sydney NSW 2000" className={inputClass()} />
            </Field>
          </>
        )}
      </div>
      {state.error && !state.field && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-bad">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-3 border-t pt-5">
        <button className={btn} disabled={pending || !changed || userCheck === "taken" || userCheck === "invalid"}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <Link href="/" className={ghost}>Cancel</Link>
        <span className="text-sm text-muted">{changed ? "You have unsaved changes." : "No changes yet."}</span>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, empty);
  const [pw, setPw] = useState("");
  const err = (f: string) => (state.field === f ? state.error : undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Current password" htmlFor="current_password" error={err("current_password")}>
        <PasswordInput id="current_password" name="current_password" autoComplete="current-password" invalid={!!err("current_password")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="new_password" error={err("new_password")} hint="At least 8 characters, with letters and numbers.">
          <PasswordInput id="new_password" name="new_password" autoComplete="new-password" value={pw} onChange={setPw} invalid={!!err("new_password")} />
          <StrengthMeter password={pw} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm_password" error={err("confirm_password")}>
          <PasswordInput id="confirm_password" name="confirm_password" autoComplete="new-password" invalid={!!err("confirm_password")} />
        </Field>
      </div>
      {state.error && !state.field && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-bad">{state.error}</p>}
      <button className={btn} disabled={pending}>{pending ? "Updating…" : "Update password"}</button>
    </form>
  );
}
