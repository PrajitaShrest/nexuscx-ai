import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suspended?: string }> }) {
  const { suspended } = await searchParams;
  return (
    <AuthCard title="Welcome back" subtitle="Sign in with your username or email.">
      {suspended && (
        <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-bad">
          Your account is suspended. Please contact your administrator.
        </p>
      )}
      <LoginForm portal="customer" />
      <div className="mt-8 space-y-2 text-sm text-muted">
        <p>New here? <Link href="/signup" className="font-semibold text-indigo-600 hover:underline">Create a customer account</Link></p>
        <p>Work at NexusCX? <Link href="/staff/login" className="font-semibold text-indigo-600 hover:underline">Staff sign-in</Link></p>
      </div>
    </AuthCard>
  );
}
