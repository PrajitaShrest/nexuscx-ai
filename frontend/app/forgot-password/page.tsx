"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/app/auth/actions";
import AuthCard from "@/components/AuthCard";
import Field, { inputClass } from "@/components/Field";
import FormMessage from "@/components/FormMessage";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <AuthCard title="Reset your password" subtitle="Enter your username or email and we'll email you a link to choose a new password.">
      {state.ok ? (
        <FormMessage ok={state.ok} />
      ) : (
        <form action={action} className="space-y-5" noValidate>
          <Field label="Username or email" htmlFor="identifier" error={state.field === "identifier" ? state.error : undefined}>
            <input id="identifier" name="identifier" required autoComplete="username" autoFocus className={inputClass()} />
          </Field>
          <FormMessage error={state.field ? undefined : state.error} />
          <button disabled={pending}
            className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60">
            {pending ? "Sending…" : "Email me a reset link"}
          </button>
        </form>
      )}
      <p className="mt-8 text-sm text-muted">
        Remembered it? <Link href="/login" className="font-semibold text-indigo-600 hover:underline">Back to sign-in</Link>
      </p>
    </AuthCard>
  );
}
