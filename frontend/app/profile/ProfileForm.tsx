"use client";

import { useActionState } from "react";
import { saveName, type ProfileState } from "./actions";
import FormMessage from "@/components/FormMessage";

export default function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveName, {});
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Full name
        <input name="name" defaultValue={name} className="mt-1 w-full rounded-md border px-3 py-2 text-gray-900" />
      </label>
      <FormMessage error={state.error} ok={state.ok} />
      <button disabled={pending} className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-60">Save</button>
    </form>
  );
}
