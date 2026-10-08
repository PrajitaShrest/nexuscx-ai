import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ forced?: string }> }) {
  const { forced } = await searchParams;
  return <ResetPasswordForm forced={forced === "1"} />;
}
