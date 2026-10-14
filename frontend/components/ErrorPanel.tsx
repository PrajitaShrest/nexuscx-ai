"use client";
import Link from "next/link";
import { useEffect } from "react";
import { LogoMark } from "./Logo";

// Shared "something went wrong" box used by every error.tsx.
// It never shows the technical message to the user; the digest helps us find it in the logs.
export default function ErrorPanel({ error, reset, home, homeLabel }: { error: Error & { digest?: string }; reset: () => void; home: string; homeLabel: string }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div role="alert" className="mx-auto my-16 max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
      <LogoMark size={44} className="mx-auto" />
      <h1 className="mt-4 text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-gray-600">This page could not load. It may be a short connection problem. Your data is safe.</p>
      {error.digest && <p className="mt-2 text-xs text-gray-400">Reference: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Try again</button>
        <Link href={home} className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{homeLabel}</Link>
      </div>
    </div>
  );
}
