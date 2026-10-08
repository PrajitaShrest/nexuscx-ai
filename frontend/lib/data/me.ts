import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Me = {
  user_id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  extraRoles: string[];
  team: string | null;
  permissions: string[];
};

export const ROLE_LABEL: Record<string, string> = {
  customer: "Customer",
  support_agent: "Support Agent",
  team_leader: "Team Leader",
  knowledge_manager: "Knowledge Manager",
  business_specialist: "Business Specialist",
  administrator: "Administrator",
};

// The signed-in user's profile, roles and permissions (main role + extra roles).
// Checked on the server on every page: not signed in -> /login,
// suspended -> signed out, temporary password -> must choose a new one.
export async function getMe(): Promise<Me> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims) redirect("/login");

  const { data: user, error } = await supabase
    .from("users")
    .select("user_id, name, username, email, role, status, must_change_password, teams(name)")
    .eq("auth_user_id", auth.claims.sub)
    .single();
  if (error || !user) {
    console.error("[getMe]", error?.message);
    await supabase.auth.signOut();
    redirect("/login?error=profile");
  }
  if (user.status !== "active") {
    await supabase.auth.signOut();
    redirect("/login?suspended=1");
  }
  if (user.must_change_password) redirect("/reset-password?forced=1");

  const { data: extra } = await supabase.from("user_roles").select("role").eq("user_id", user.user_id);
  const extraRoles = (extra ?? []).map((r) => r.role);
  const { data: perms } = await supabase.from("role_permissions").select("permission").in("role", [user.role, ...extraRoles]);
  const team = (user.teams as unknown as { name: string } | null)?.name ?? null;

  return {
    user_id: user.user_id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    extraRoles,
    team,
    permissions: [...new Set((perms ?? []).map((p) => p.permission))],
  };
}

export function isStaff(me: Me) {
  return me.role !== "customer";
}

export function can(me: Me, permission: string) {
  return me.permissions.includes(permission);
}
