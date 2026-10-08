"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckIcon, XIcon } from "./Icons";

const MESSAGES: Record<string, string> = {
  profile: "Your profile has been updated.",
  password: "Your password has been changed.",
};

// Shows a short success message after a redirect, e.g. /support?saved=profile,
// then removes ?saved from the address bar so a refresh does not show it again.
export default function Toast() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const key = params.get("saved");
  const [text, setText] = useState<string | null>(null);
  const [seen, setSeen] = useState<string | null>(null);
  // A new ?saved value arrived: show its message (state update during render, no effect needed)
  if (key !== seen) {
    setSeen(key);
    if (key && MESSAGES[key]) setText(MESSAGES[key]);
  }

  useEffect(() => {
    if (!key || !MESSAGES[key]) return;
    const rest = new URLSearchParams(params.toString());
    rest.delete("saved");
    router.replace(rest.size ? `${path}?${rest}` : path, { scroll: false });
  }, [key, params, path, router]);

  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setText(null), 4500);
    return () => clearTimeout(t);
  }, [text]);

  if (!text) return null;
  return (
    <div role="status" className="toast fixed right-4 top-4 z-[100] flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-xl">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><CheckIcon className="h-4 w-4" /></span>
      <p className="text-sm font-medium text-ink">{text}</p>
      <button onClick={() => setText(null)} aria-label="Close" className="ml-1 rounded-full p-1 text-muted hover:bg-slate-100"><XIcon className="h-4 w-4" /></button>
    </div>
  );
}
