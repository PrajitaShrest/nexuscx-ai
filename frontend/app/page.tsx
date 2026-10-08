import { redirect } from "next/navigation";
import { getMe, isStaff, can } from "@/lib/data/me";

// Home: send each user to the first screen their roles allow.
// A "saved" message (after editing the profile) is passed along.
export default async function Home({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const me = await getMe();
  const { saved } = await searchParams;
  const q = saved ? `?saved=${encodeURIComponent(saved)}` : "";
  if (!isStaff(me)) redirect(`/support${q}`);
  if (can(me, "view_cases")) redirect(`/conversations${q}`);
  if (can(me, "manage_users")) redirect(`/users${q}`);
  redirect(`/profile${q}`);
}
