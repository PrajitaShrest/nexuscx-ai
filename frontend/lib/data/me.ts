import { cache } from "react";
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
  presence: string;
  permissions: string[];
  org: "ecommerce" | "university" | null;
  jobTitle: string | null; // e.g. "Librarian" (migration 023); shown instead of the system role name // the organisation the account belongs to (null = platform team)
};

export const ROLE_LABEL: Record<string, string> = {
  customer: "Customer",
  support_agent: "Support Agent",
  team_leader: "Team Leader",
  knowledge_manager: "Knowledge Manager",
  business_specialist: "Business Specialist",
  administrator: "Administrator",
};

// Cached for one request: the layout, the page and the menu all share one lookup.
// The signed-in user's profile, roles and permissions (main role + extra roles).
// Checked on the server on every page: not signed in -> /login,
// suspended -> signed out, temporary password -> must choose a new one.
export const getMe = cache(async function getMe(): Promise<Me> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  if (authError || !auth?.claims) redirect("/login");

  // One trip for the person (with extra roles) and one for the small permissions table, side by side
  const [{ data: user, error }, { data: perms }] = await Promise.all([
    supabase.from("users")
      .select("user_id, name, username, email, role, status, presence, must_change_password, industry, job_title, teams(name), user_roles!user_roles_user_id_fkey(role)")
      .eq("auth_user_id", auth.claims.sub).single(),
    supabase.from("role_permissions").select("role, permission"),
  ]);
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

  const extraRoles = ((user.user_roles ?? []) as { role: string }[]).map((r) => r.role);
  const roles = new Set([user.role, ...extraRoles]);
  const team = (user.teams as unknown as { name: string } | null)?.name ?? null;

  return {
    user_id: user.user_id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    extraRoles,
    team,
    presence: user.presence ?? "online",
    jobTitle: user.job_title ?? null,
    org: user.industry === "ecommerce" || user.industry === "university" ? user.industry : null,
    permissions: [...new Set((perms ?? []).filter((p) => roles.has(p.role)).map((p) => p.permission))],
  };
});

export function isStaff(me: Me) {
  return me.role !== "customer";
}

export function can(me: Me, permission: string) {
  return me.permissions.includes(permission);
}

// The role names to show for a person: their job title if they have one,
// "Student" for a university customer, otherwise the system role names.
export function roleNames(me: Me, industry?: string): string[] {
  const uni = (me.org ?? industry) === "university";
  if (me.jobTitle) return [me.jobTitle];
  return [me.role, ...me.extraRoles].map((r) =>
    r === "customer" && uni ? "Student" : ROLE_LABEL[r] ?? r);
}

// What the account menu needs to show
export function menuUser(me: Me, industry?: string) {
  return {
    name: me.name, username: me.username, email: me.email, staff: isStaff(me), presence: me.presence,
    roles: roleNames(me, industry),
  };
}
