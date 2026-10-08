"use client";

import { useActionState, useState } from "react";
import { updatePassword, type FormState } from "@/app/auth/actions";
import AuthCard from "@/components/AuthCard";
import Check from "@/components/Check";
import Field from "@/components/Field";
import FormMessage from "@/components/FormMessage";
import PasswordInput from "@/components/PasswordInput";
import StrengthMeter from "@/components/StrengthMeter";

export default function ResetPasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, {});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const err = (f: string) => (state.field === f ? state.error : undefined);
  return (
    <AuthCard title="Choose a new password"
      subtitle={forced ? "Your administrator gave you a temporary password. Please choose your own before you continue." : "You'll be signed in when you save it."}>
      <form action={action} className="space-y-5" noValidate>
        <Field label="New password" htmlFor="password" error={err("password")}>
          <PasswordInput id="password" name="password" autoComplete="new-password" value={password} onChange={setPassword} invalid={Boolean(err("password"))} />
          <StrengthMeter password={password} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm_password" error={err("confirm_password")}>
          <PasswordInput id="confirm_password" name="confirm_password" autoComplete="new-password" value={confirm} onChange={setConfirm} invalid={Boolean(err("confirm_password"))} />
        </Field>
        <ul className="space-y-1">
          <Check ok={password.length >= 8}>At least 8 characters</Check>
          <Check ok={/[a-zA-Z]/.test(password) && /\d/.test(password)}>Letters and numbers</Check>
          <Check ok={password.length > 0 && password === confirm}>Both passwords match</Check>
        </ul>
        <FormMessage error={state.field ? undefined : state.error} />
        <button disabled={pending}
          className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save new password"}
        </button>
      </form>
    </AuthCard>
  );
}
