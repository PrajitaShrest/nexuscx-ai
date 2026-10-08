import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";

export default function StaffLoginPage() {
  return (
    <AuthCard variant="staff" title="Staff sign-in" subtitle="For support agents, team leaders, knowledge managers and administrators.">
      <LoginForm portal="staff" />
      <p className="mt-8 text-sm text-muted">
        Need help as a customer? <Link href="/login" className="font-semibold text-indigo-600 hover:underline">Customer sign-in</Link>
      </p>
      <p className="mt-2 text-sm text-muted">Staff accounts are created by an administrator. Ask yours if you need access.</p>
    </AuthCard>
  );
}
