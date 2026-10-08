"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/data/me";
import { setMyPresence, updateMyProfile } from "@/lib/data/profile";
import { passwordProblem } from "@/lib/auth/password";
import { normaliseMobile } from "@/lib/auth/phone";

export type ProfileState = { error?: string; field?: string };

const USERNAME_RE = /^[a-zA-Z0-9._]{3,30}$/;

// Save the profile, then go back to the person's home page with a "saved" message.
// The user id always comes from the session, never from the form.
export async function saveProfile(_prev: ProfileState, f: FormData): Promise<ProfileState> {
  const me = await getMe();
  const name = String(f.get("name") ?? "").trim();
  const username = String(f.get("username") ?? "").trim();
  if (name.length < 2 || name.length > 100) return { error: "Please enter your full name (2–100 characters).", field: "name" };
  if (!USERNAME_RE.test(username)) return { error: "Use 3–30 letters, numbers, dots or underscores.", field: "username" };

  let phone: string | null = null, address: string | null = null, dob: string | null = null;
  if (me.role === "customer") {
    const rawPhone = String(f.get("phone") ?? "").trim();
    if (rawPhone) {
      phone = normaliseMobile(rawPhone);
      if (!phone) return { error: "Enter an Australian mobile, like 0412 345 678.", field: "phone" };
    }
    address = String(f.get("address") ?? "").trim().slice(0, 255) || null;
    dob = String(f.get("date_of_birth") ?? "") || null;
    if (dob && new Date(`${dob}T00:00:00`) > new Date()) return { error: "Date of birth cannot be in the future.", field: "date_of_birth" };
  }

  const r = await updateMyProfile(me, { name, username, phone, address, dob });
  if (r.error) return r;
  revalidatePath("/", "layout");
  redirect("/?saved=profile");
}

// Change password while signed in: check the current password first.
export async function changePassword(_prev: ProfileState, f: FormData): Promise<ProfileState> {
  const me = await getMe();
  const current = String(f.get("current_password") ?? "");
  const next = String(f.get("new_password") ?? "");
  const confirm = String(f.get("confirm_password") ?? "");
  if (!current) return { error: "Enter your current password.", field: "current_password" };
  const problem = passwordProblem(next);
  if (problem) return { error: problem, field: "new_password" };
  if (next !== confirm) return { error: "The two passwords do not match.", field: "confirm_password" };
  if (next === current) return { error: "Choose a different password from your current one.", field: "new_password" };

  const supabase = await createClient();
  // Same lock-out rule as the sign-in page, so this cannot be used to guess passwords
  const { data: locked } = await supabase.rpc("login_lock_status", { p_email: me.email });
  if (typeof locked === "number" && locked > 0) return { error: "Too many wrong attempts. Please try again in 15 minutes." };
  const { error: wrong } = await supabase.auth.signInWithPassword({ email: me.email, password: current });
  if (wrong) {
    await supabase.rpc("record_login_attempt", { p_email: me.email, p_success: false });
    return { error: "Your current password is not correct.", field: "current_password" };
  }
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    console.error("[changePassword]", error.code, error.message);
    return { error: error.code === "weak_password" ? "Choose a stronger password." : "We could not change your password. Please try again." };
  }
  redirect("/?saved=password");
}

// Staff availability from the account menu
export async function setPresence(presence: string) {
  if (!["online", "busy", "away"].includes(presence)) return;
  const me = await getMe();
  await setMyPresence(me, presence);
  revalidatePath("/", "layout");
}
