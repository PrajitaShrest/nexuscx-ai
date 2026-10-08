import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "./errors";
import type { Me } from "./me";

export type Profile = {
  created_at: string; last_sign_in_at: string | null;
  phone: string | null; address: string | null; date_of_birth: string | null; tier: string | null;
};

// Extra details for the profile page (RLS: people can only read their own)
export async function getProfile(me: Me): Promise<Profile> {
  const supabase = await createClient();
  const [{ data: u }, { data: auth }] = await Promise.all([
    supabase.from("users").select("created_at, customers(phone, address, date_of_birth, tier)").eq("user_id", me.user_id).single(),
    supabase.auth.getUser(),
  ]);
  const c = (Array.isArray(u?.customers) ? u?.customers[0] : u?.customers) as
    { phone: string | null; address: string | null; date_of_birth: string | null; tier: string } | null | undefined;
  return {
    created_at: u?.created_at ?? new Date().toISOString(),
    last_sign_in_at: auth?.user?.last_sign_in_at ?? null,
    phone: c?.phone ?? null, address: c?.address ?? null, date_of_birth: c?.date_of_birth ?? null, tier: c?.tier ?? null,
  };
}

export async function updateMyProfile(me: Me, v: { name: string; username: string; phone?: string | null; address?: string | null; dob?: string | null }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").update({ name: v.name, username: v.username })
    .eq("user_id", me.user_id).select("user_id");
  if (error) {
    if (error.code === "23505") return { error: "That username is taken. Try adding a number or a dot.", field: "username" };
    return { error: friendlyError(error, "updateMyProfile") };
  }
  if (!data?.length) return { error: "You are not allowed to do this." };
  if (me.role === "customer") {
    const { error: e2 } = await supabase.from("customers")
      .update({ phone: v.phone, address: v.address, date_of_birth: v.dob }).eq("user_id", me.user_id);
    if (e2) return { error: friendlyError(e2, "updateMyProfile.customer"), field: e2.code === "22023" ? "date_of_birth" : undefined };
  }
  return {};
}

export async function setMyPresence(me: Me, presence: string) {
  const supabase = await createClient();
  await supabase.from("users").update({ presence, last_active_at: new Date().toISOString() }).eq("user_id", me.user_id);
}
