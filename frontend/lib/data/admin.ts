import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "./errors";

// Administrator tools. Every function below calls a database function that
// checks manage_users itself, so these are safe even if the page check is bypassed.

export type Person = {
  user_id: string; name: string; username: string; email: string; role: string; status: string;
  presence: string; last_active_at: string | null; must_change_password: boolean; has_login: boolean;
  team: string | null; extra_roles: string[];
};

export type Overview = Person & {
  team_id: string | null; created_at: string; last_sign_in_at: string | null;
  locked_seconds: number; is_self: boolean; case_count: number;
  activity: { at: string; actor: string; action: string; result: string }[];
};

export async function listPeople(): Promise<{ data: Person[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("v_people").select("*").order("name");
  if (error) return { data: [], error: friendlyError(error, "listPeople") };
  return { data: data as Person[] };
}

export async function listTeams(): Promise<{ team_id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("teams").select("team_id, name").order("name");
  return data ?? [];
}

export async function getOverview(userId: string): Promise<{ data?: Overview; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_user_overview", { p_user_id: userId });
  if (error) return { error: friendlyError(error, "getOverview") };
  if (!data) return { error: "That person no longer exists." };
  return { data: data as Overview };
}

async function call(fn: string, args: Record<string, unknown>, context: string): Promise<{ error?: string; data?: unknown }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    // Messages raised by our own admin functions are written for people; show them
    if (error.code === "22023") return { error: error.message };
    return { error: friendlyError(error, context) };
  }
  return { data };
}

export const adminUpdateUser = (id: string, name: string, teamId: string | null) =>
  call("admin_update_user", { p_user_id: id, p_name: name, p_team_id: teamId }, "adminUpdateUser");
export const adminSetRoles = (id: string, primary: string, extra: string[]) =>
  call("admin_set_roles", { p_user_id: id, p_primary: primary, p_extra: extra }, "adminSetRoles");
export const adminSetStatus = (id: string, status: "active" | "suspended") =>
  call("admin_set_status", { p_user_id: id, p_status: status }, "adminSetStatus");
export const adminUnlock = (id: string) => call("admin_unlock", { p_user_id: id }, "adminUnlock");
export const adminSetTempPassword = (id: string, password: string) =>
  call("admin_set_temp_password", { p_user_id: id, p_password: password }, "adminSetTempPassword");
export const adminDeleteUser = (id: string) => call("admin_delete_user", { p_user_id: id }, "adminDeleteUser");
export const adminSetPermission = (role: string, permission: string, granted: boolean) =>
  call("admin_set_permission", { p_role: role, p_permission: permission, p_granted: granted }, "adminSetPermission");

export async function sendResetLink(email: string, origin: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  if (error) {
    console.error("[sendResetLink]", error.code, error.message);
    if (error.code === "over_email_send_rate_limit") return { error: "Supabase's email limit is reached. Try again later or set a temporary password instead." };
    return { error: "We couldn't send the email. Try setting a temporary password instead." };
  }
  return {};
}
