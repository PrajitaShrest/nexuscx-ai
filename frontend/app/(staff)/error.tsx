"use client";
import ErrorPanel from "@/components/ErrorPanel";

export default function StaffError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel error={error} reset={reset} home="/dashboard" homeLabel="Back to dashboard" />;
}
