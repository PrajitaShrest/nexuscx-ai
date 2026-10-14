"use client";
import ErrorPanel from "@/components/ErrorPanel";

export default function CustomerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} home="/account" homeLabel="Back to my account" />;
}
