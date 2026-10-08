import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "./errors";

export type UserRow = {
  user_id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  presence: string;
  last_active_at: string | null;
  teams: { name: string } | null;
};

export const ROLES = [
  "customer",
  "support_agent",
  "team_leader",
  "knowledge_manager",
  "business_specialist",
  "administrator",
] as const;

export const PERMISSIONS = [
  "view_cases",
  "resolve_cases",
  "manage_knowledge",
  "configure_ai",
  "view_analytics",
  "view_audit_logs",
  "manage_users",
] as const;

export async function listUsers(): Promise<{ data: UserRow[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("user_id, name, username, email, role, presence, last_active_at, teams(name)")
    .order("role")
    .order("name");
  if (error) return { data: [], error: friendlyError(error, "listUsers") };
  return { data: data as unknown as UserRow[] };
}

export async function listRolePermissions(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("role_permissions").select("role, permission");
  return new Set((data ?? []).map((r) => `${r.role}:${r.permission}`));
}

// Admin function. The database refuses it for anyone without manage_users.
export async function setUserRole(userId: string, role: string): Promise<{ error?: string }> {
  if (!ROLES.includes(role as (typeof ROLES)[number])) return { error: "Please choose a valid role." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").update({ role }).eq("user_id", userId).select("user_id");
  if (error) return { error: friendlyError(error, "setUserRole") };
  if (!data || data.length === 0) return { error: "You are not allowed to do this." }; // RLS: no rows changed
  return {};
}

export async function updateMyName(userId: string, name: string): Promise<{ error?: string }> {
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 100) return { error: "Please enter a name between 2 and 100 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").update({ name: clean }).eq("user_id", userId).select("user_id");
  if (error) return { error: friendlyError(error, "updateMyName") };
  if (!data || data.length === 0) return { error: "You are not allowed to do this." };
  return {};
}
