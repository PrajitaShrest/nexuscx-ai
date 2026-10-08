"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_COOKIE, SEEN_COOKIE } from "@/lib/auth/cookies";
import { passwordProblem } from "@/lib/auth/password";

// field = which input the error belongs to, so the page can show it under that box
export type FormState = { error?: string; field?: string; ok?: string; values?: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9._]{3,30}$/;
const MIN_AGE = 10;
const STAFF_ROLES = ["support_agent", "team_leader", "knowledge_manager", "business_specialist", "administrator"];
const ROLE_LABEL: Record<string, string> = {
  support_agent: "Support Agent", team_leader: "Team Leader", knowledge_manager: "Knowledge Manager",
  business_specialist: "Business Specialist", administrator: "Administrator",
};

// Whole years between date of birth and today
function ageOn(dob: Date, today = new Date()) {
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

// Australian mobile: 04xx xxx xxx or +61 4xx xxx xxx -> +614xxxxxxxx
function normaliseMobile(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, "");
  if (/^04\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^\+?614\d{8}$/.test(digits)) return `+${digits.replace(/^\+/, "")}`;
  return null;
}

function minutes(seconds: number) {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return `${m} minute${m === 1 ? "" : "s"}`;
}

// Turn "riley.support" or "riley@example.com" into the email Supabase signs in with
async function resolveEmail(identifier: string): Promise<string> {
  if (identifier.includes("@")) return identifier;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("login_email", { p_username: identifier });
  if (error) console.error("[login] login_email", error.code, error.message);
  return typeof data === "string" ? data : "";
}

// ---------------------------------------------------------------------
// Sign in. Used by both the customer page and the staff page (portal).
// ---------------------------------------------------------------------
export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";
  const portal = String(formData.get("portal") ?? "customer");
  const expectedRole = String(formData.get("role") ?? "");
  const values = { identifier, role: expectedRole };

  if (!identifier) return { error: "Enter your username or email.", field: "identifier", values };
  if (!password) return { error: "Enter your password.", field: "password", values };

  const email = await resolveEmail(identifier);
  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_COOKIE, remember ? "1" : "0", {
    httpOnly: true, sameSite: "lax", path: "/", ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
  cookieStore.set(SEEN_COOKIE, String(Date.now()), { httpOnly: true, sameSite: "lax", path: "/" });
  const supabase = await createClient({ remember });

  // Locked after too many wrong passwords? (checked in the database)
  if (email) {
    const { data: lockedFor } = await supabase.rpc("login_lock_status", { p_email: email });
    if (typeof lockedFor === "number" && lockedFor > 0) {
      return { error: `Too many wrong attempts. For your security, this account is locked for ${minutes(lockedFor)}.`, values };
    }
  }

  const { error } = email
    ? await supabase.auth.signInWithPassword({ email, password })
    : { error: { code: "unknown_username", message: "no such username" } };

  if (email) {
    const { data: lockedNow } = await supabase.rpc("record_login_attempt", { p_email: email, p_success: !error });
    if (error && typeof lockedNow === "number" && lockedNow > 0) {
      return { error: `Too many wrong attempts. For your security, this account is locked for ${minutes(lockedNow)}.`, values };
    }
  }
  if (error) {
    console.error("[login]", error.code, error.message);
    // One message for every failure: do not reveal which usernames or emails exist
    return { error: "Incorrect username/email or password.", values };
  }

  // Check the account's real role (from the database, not from the form)
  const { data: claims } = await supabase.auth.getClaims();
  const { data: me } = await supabase.from("users")
    .select("user_id, role, status, must_change_password").eq("auth_user_id", claims?.claims.sub ?? "").single();
  const role = me?.role ?? "customer";

  if (me && me.status !== "active") {
    await supabase.auth.signOut();
    return { error: "This account is suspended. Please contact your administrator.", values };
  }
  const { data: extra } = await supabase.from("user_roles").select("role").eq("user_id", me?.user_id ?? "");
  const allRoles = [role, ...(extra ?? []).map((r) => r.role)];

  if (portal === "staff") {
    if (!STAFF_ROLES.includes(role)) {
      await supabase.auth.signOut();
      return { error: "This page is for NexusCX staff. Customers can sign in on the customer page.", values };
    }
    if (expectedRole && !allRoles.includes(expectedRole)) {
      await supabase.auth.signOut();
      return {
        error: `This account is set up as ${ROLE_LABEL[role]}, not ${ROLE_LABEL[expectedRole]}. Choose ${ROLE_LABEL[role]} and try again.`,
        field: "role", values,
      };
    }
  }

  revalidatePath("/", "layout");
  if (me?.must_change_password) redirect("/reset-password?forced=1");
  redirect(role === "customer" ? "/support" : "/conversations");
}

// ---------------------------------------------------------------------
// Live username check on the sign-up page
// ---------------------------------------------------------------------
export async function checkUsername(username: string): Promise<"available" | "taken" | "invalid"> {
  if (!USERNAME_RE.test(username)) return "invalid";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("username_available", { p_username: username });
  if (error) {
    console.error("[checkUsername]", error.code, error.message);
    return "available"; // do not block typing; the final check happens on submit
  }
  return data === false ? "taken" : "available";
}

// ---------------------------------------------------------------------
// Register a customer. Validated here on the server, and again in the database.
// ---------------------------------------------------------------------
export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const dobText = String(formData.get("date_of_birth") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  const terms = formData.get("terms") === "on";
  const values = { full_name: fullName, username, email, phone: phoneRaw, date_of_birth: dobText };

  if (fullName.length < 2) return { error: "Please enter your full name.", field: "full_name", values };

  const dob = new Date(`${dobText}T00:00:00`);
  if (!dobText || Number.isNaN(dob.getTime())) return { error: "Please enter your date of birth.", field: "date_of_birth", values };
  if (dob > new Date()) return { error: "Date of birth cannot be in the future.", field: "date_of_birth", values };
  if (ageOn(dob) < MIN_AGE)
    return { error: `You must be at least ${MIN_AGE} years old to create an account.`, field: "date_of_birth", values };

  let phone: string | null = null;
  if (phoneRaw) {
    phone = normaliseMobile(phoneRaw);
    if (!phone) return { error: "Enter an Australian mobile, like 0412 345 678.", field: "phone", values };
  }

  if (!USERNAME_RE.test(username))
    return { error: "Use 3–30 letters, numbers, dots or underscores.", field: "username", values };
  if (!EMAIL_RE.test(email))
    return { error: "Please enter a valid email address, like name@example.com.", field: "email", values };

  const pwProblem = passwordProblem(password);
  if (pwProblem) return { error: pwProblem, field: "password", values };
  if (password !== confirm) return { error: "The two passwords do not match.", field: "confirm_password", values };
  if (!terms) return { error: "Please agree to the Terms of Use and Privacy Policy.", field: "terms", values };

  if ((await checkUsername(username)) === "taken")
    return { error: "That username is taken. Try adding a number or a dot.", field: "username", values };

  // New accounts are not "remembered": the session ends when the browser closes or after 30 idle minutes
  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_COOKIE, "0", { httpOnly: true, sameSite: "lax", path: "/" });
  cookieStore.set(SEEN_COOKIE, String(Date.now()), { httpOnly: true, sameSite: "lax", path: "/" });
  const supabase = await createClient({ remember: false });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName, username, date_of_birth: dobText,
        phone: phone ?? "", terms_accepted_at: new Date().toISOString(),
      },
    },
  });
  if (error) {
    console.error("[signup]", error.code, error.message);
    if (error.code === "user_already_exists" || /already registered/i.test(error.message))
      return { error: "An account with this email already exists. Try signing in instead.", field: "email", values };
    if (error.code === "weak_password")
      return { error: "Choose a stronger password: mix letters, numbers and symbols.", field: "password", values };
    if (error.code === "over_email_send_rate_limit")
      return { error: "Supabase is still trying to send confirmation emails. Turn off \"Confirm email\" (Authentication → Sign In / Providers → User Signups).", values };
    if (error.code === "email_provider_disabled" || error.code === "signup_disabled")
      return { error: "Sign-up is switched off in Supabase (Authentication → Sign In / Providers → Email).", values };
    return { error: "We could not create your account. Please try again.", values };
  }
  if (!data.session) return { ok: "Account created. Please check your email, then sign in." };
  revalidatePath("/", "layout");
  redirect("/support");
}

// ---------------------------------------------------------------------
// Forgot password: email a reset link. Same reply whether or not the
// account exists, so the page cannot be used to discover accounts.
// ---------------------------------------------------------------------
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) return { error: "Enter your username or email.", field: "identifier" };
  const email = await resolveEmail(identifier);
  if (email) {
    const origin = (await headers()).get("origin") ?? "http://localhost:3000";
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
    if (error) {
      console.error("[requestPasswordReset]", error.code, error.message);
      if (error.code === "over_email_send_rate_limit")
        return { error: "Too many reset emails have been sent. Please wait a few minutes and try again." };
    }
  }
  return { ok: "If an account matches, we've sent a link to reset your password. It works for 1 hour." };
}

// Set a new password (the reset link signs the user in first)
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  const pwProblem = passwordProblem(password);
  if (pwProblem) return { error: pwProblem, field: "password" };
  if (password !== confirm) return { error: "The two passwords do not match.", field: "confirm_password" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("[updatePassword]", error.code, error.message);
    if (error.code === "same_password") return { error: "Choose a password you haven't used here before.", field: "password" };
    return { error: "Your reset link has expired. Please request a new one." };
  }
  await supabase.rpc("clear_my_password_flag");
  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { data: me } = await supabase.from("users").select("role").eq("auth_user_id", data?.claims.sub ?? "").single();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(me?.role && me.role !== "customer" ? "/staff/login" : "/login");
}
