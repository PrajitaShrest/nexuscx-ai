"use client";
import ErrorPanel from "@/components/ErrorPanel";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} home="/" homeLabel="Go home" />;
}
