import { redirect } from "next/navigation";
import { getMe, isStaff, can } from "@/lib/data/me";
import { createClient } from "@/lib/supabase/server";
import Landing from "@/components/Landing";
import type { Metadata } from "next";

export const metadata: Metadata = { title: { absolute: "NexusCX AI · AI customer support, people when it matters" } };

// Home: visitors who are not signed in see the landing page.
// Signed-in users go to the first screen their roles allow.
// A "saved" message (after editing the profile) is passed along.
export default async function Home({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return <Landing />;
  const me = await getMe();
  const { saved } = await searchParams;
  const q = saved ? `?saved=${encodeURIComponent(saved)}` : "";
  if (!isStaff(me)) redirect(`/account${q}`);
  if (can(me, "view_cases")) redirect(`/dashboard${q}`);
  if (can(me, "manage_knowledge")) redirect(`/knowledge${q}`);
  if (can(me, "manage_users")) redirect(`/users${q}`);
  redirect(`/profile${q}`);
}
