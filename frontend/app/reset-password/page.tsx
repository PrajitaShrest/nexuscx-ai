import ResetPasswordForm from "./ResetPasswordForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ forced?: string }> }) {
  const { forced } = await searchParams;
  return <ResetPasswordForm forced={forced === "1"} />;
}
