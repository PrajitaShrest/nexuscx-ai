import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <AuthCard variant="staff" title="Staff sign-in" subtitle="For support agents, team leaders, knowledge managers and administrators.">
      {expired && (
        <p role="status" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          You were signed out after 30 minutes of no activity. Please sign in again.
        </p>
      )}
      <LoginForm portal="staff" />
      <p className="mt-8 text-sm text-muted">
        Need help as a customer? <Link href="/login" className="font-semibold text-indigo-600 hover:underline">Customer sign-in</Link>
      </p>
      <p className="mt-2 text-sm text-muted">Staff accounts are created by an administrator. Ask yours if you need access.</p>
    </AuthCard>
  );
}
