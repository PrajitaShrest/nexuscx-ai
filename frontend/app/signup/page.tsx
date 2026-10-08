"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { checkUsername, signup, type FormState } from "@/app/auth/actions";
import AuthCard from "@/components/AuthCard";
import Check from "@/components/Check";
import Field, { inputClass } from "@/components/Field";
import FormMessage from "@/components/FormMessage";
import PasswordInput from "@/components/PasswordInput";
import StrengthMeter from "@/components/StrengthMeter";
import { passwordProblem } from "@/lib/auth/password";

const MIN_AGE = 10;
const USERNAME_RE = /^[a-zA-Z0-9._]{3,30}$/;

function ageFrom(dob: string) {
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age -= 1;
  return age;
}

type NameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function SignupPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(signup, {});
  const v = state.values ?? {};
  const [username, setUsername] = useState(v.username ?? "");
  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const [dob, setDob] = useState(v.date_of_birth ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);

  // Check the username shortly after the person stops typing
  useEffect(() => {
    if (!username) { setNameStatus("idle"); return; }
    if (!USERNAME_RE.test(username)) { setNameStatus("invalid"); return; }
    setNameStatus("checking");
    const t = setTimeout(async () => setNameStatus(await checkUsername(username)), 450);
    return () => clearTimeout(t);
  }, [username]);

  const err = (f: string) => (state.field === f ? state.error : undefined);
  const age = dob ? ageFrom(dob) : null;
  const tooYoung = age !== null && age < MIN_AGE;
  const today = new Date().toISOString().slice(0, 10);
  const passwordOk = password.length > 0 && !passwordProblem(password);
  const matches = password.length > 0 && password === confirm;

  const usernameNote =
    nameStatus === "invalid" ? { error: "Use 3–30 letters, numbers, dots or underscores." } :
    nameStatus === "taken" ? { error: "That username is taken. Try adding a number or a dot." } :
    nameStatus === "available" ? { ok: `${username} is available.` } :
    nameStatus === "checking" ? { hint: "Checking…" } :
    { hint: "You can sign in with this or your email." };

  return (
    <AuthCard title="Create your account" subtitle="It takes a minute. You can then message our support team any time.">
      <form action={action} className="space-y-8" noValidate>
        <fieldset className="space-y-4">
          <legend className="mb-3 text-base font-bold text-ink">About you</legend>
          <Field label="Full name" htmlFor="full_name" error={err("full_name")}>
            <input id="full_name" name="full_name" required autoComplete="name" defaultValue={v.full_name}
              className={inputClass(Boolean(err("full_name")))} />
          </Field>
          <Field label="Date of birth" htmlFor="date_of_birth"
            error={err("date_of_birth") ?? (tooYoung ? `You must be at least ${MIN_AGE} years old to create an account.` : undefined)}
            hint={`You need to be ${MIN_AGE} or older.`}>
            <input id="date_of_birth" name="date_of_birth" type="date" required max={today} autoComplete="bday"
              value={dob} onChange={(e) => setDob(e.target.value)}
              className={inputClass(tooYoung || Boolean(err("date_of_birth")))} />
          </Field>
          <Field label="Mobile number (optional)" htmlFor="phone" error={err("phone")}
            hint="Australian mobile. We only use it to contact you about your requests.">
            <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v.phone}
              placeholder="0412 345 678" className={inputClass(Boolean(err("phone")))} />
          </Field>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 text-base font-bold text-ink">Your sign-in details</legend>
          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-ink">Username</label>
            <input id="username" name="username" required autoComplete="username" value={username}
              onChange={(e) => setUsername(e.target.value.trim())} placeholder="e.g. sarah.chen"
              aria-describedby="username-note"
              className={`mt-1.5 ${inputClass(Boolean(usernameNote.error || err("username")))}`} />
            <p id="username-note" aria-live="polite"
              className={`mt-1.5 text-sm ${usernameNote.error || err("username") ? "text-bad" : usernameNote.ok ? "text-ok" : "text-muted"}`}>
              {err("username") ?? usernameNote.error ?? usernameNote.ok ?? usernameNote.hint}
            </p>
          </div>
          <Field label="Email" htmlFor="email" error={err("email")} hint="You can also sign in with this.">
            <input id="email" name="email" type="email" required autoComplete="email" defaultValue={v.email}
              placeholder="name@example.com" className={inputClass(Boolean(err("email")))} />
          </Field>
          <Field label="Password" htmlFor="password" error={err("password")}>
            <PasswordInput id="password" name="password" autoComplete="new-password" value={password} onChange={setPassword}
              invalid={Boolean(err("password"))} describedBy="password-rules" />
            <StrengthMeter password={password} />
          </Field>
          <Field label="Confirm password" htmlFor="confirm_password" error={err("confirm_password")}>
            <PasswordInput id="confirm_password" name="confirm_password" autoComplete="new-password"
              value={confirm} onChange={setConfirm} invalid={Boolean(err("confirm_password"))} describedBy="password-rules" />
          </Field>
          <ul id="password-rules" className="space-y-1">
            <Check ok={password.length >= 8}>At least 8 characters</Check>
            <Check ok={/[a-zA-Z]/.test(password) && /\d/.test(password)}>Letters and numbers</Check>
            <Check ok={matches}>Both passwords match</Check>
          </ul>
        </fieldset>

        <div className="space-y-4">
          <div>
            <label className="flex items-start gap-2.5 text-sm text-ink">
              <input type="checkbox" name="terms" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-indigo-600" />
              <span>
                I agree to the <Link href="/terms" target="_blank" className="font-semibold text-indigo-600 hover:underline">Terms of Use</Link> and
                the <Link href="/privacy" target="_blank" className="font-semibold text-indigo-600 hover:underline">Privacy Policy</Link>.
              </span>
            </label>
            {err("terms") && <p className="mt-1.5 text-sm text-bad">{err("terms")}</p>}
          </div>
          <FormMessage error={state.field ? undefined : state.error} ok={state.ok} />
          <button disabled={pending || tooYoung || nameStatus === "taken" || !passwordOk || !matches || !agreed}
            className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {pending ? "Creating your account…" : "Create account"}
          </button>
        </div>
      </form>
      <p className="mt-8 text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-indigo-600 hover:underline">Sign in</Link>
      </p>
    </AuthCard>
  );
}
