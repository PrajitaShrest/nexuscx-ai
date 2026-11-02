import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE, applyRemember } from "@/lib/auth/cookies";
import { CHOICE_COOKIE, CHOICE_HEADER, isIndustry } from "@/lib/packs";

// Supabase client for server code (pages, server actions, API routes).
// It reads the signed-in user's session from cookies, so every query runs
// as that user and the database's Row Level Security rules apply.
export async function createClient(opts?: { remember?: boolean }) {
  const cookieStore = await cookies();
  const remember = opts?.remember ?? cookieStore.get(REMEMBER_COOKIE)?.value !== "0";
  // The visitor's chosen demo pack, if any (E-commerce or University)
  const choice = cookieStore.get(CHOICE_COOKIE)?.value;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: isIndustry(choice) ? { headers: { [CHOICE_HEADER]: choice } } : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, applyRemember(options, remember)),
            );
          } catch {
            // Called from a Server Component: the proxy refreshes cookies instead.
          }
        },
      },
    },
  );
}
