import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";
import { getIndustry } from "@/lib/industry";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suspended?: string; expired?: string }> }) {
  const [{ suspended, expired }, industry] = await Promise.all([searchParams, getIndustry()]);
  const uni = industry === "university";
  return (
    <AuthCard industry={industry} title={uni ? "Student sign-in" : "Welcome back"}
      subtitle={uni ? "Northbridge University students and applicants. Sign in with your username or email." : "Sign in with your username or email."}>
      {suspended && (
        <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-bad">
          Your account is suspended. Please contact your administrator.
        </p>
      )}
      {expired && (
        <p role="status" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          You were signed out after 30 minutes of no activity. Please sign in again.
        </p>
      )}
      <LoginForm portal="customer" industry={industry} />
      <div className="mt-8 space-y-2 text-sm text-muted">
        <p>New here? <Link href="/signup" className="font-semibold text-indigo-600 hover:underline">{uni ? "Create a student account" : "Create a customer account"}</Link></p>
        <p>{uni ? "Lecturer or university staff?" : "Work at NexusCX?"} <Link href="/staff/login" className="font-semibold text-indigo-600 hover:underline">Staff sign-in</Link></p>
      </div>
    </AuthCard>
  );
}
