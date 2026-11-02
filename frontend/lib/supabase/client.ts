import { createBrowserClient } from "@supabase/ssr";
import { CHOICE_COOKIE, CHOICE_HEADER, isIndustry } from "@/lib/packs";

// Supabase client for code running in the browser (photo uploads, live chat updates).
// It uses the same signed-in session as the server, so Row Level Security still applies.
// It also sends the visitor's chosen demo pack, like the server client.
export function createClient() {
  const choice = typeof document === "undefined" ? undefined
    : document.cookie.split("; ").find((c) => c.startsWith(`${CHOICE_COOKIE}=`))?.split("=")[1];
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    isIndustry(choice) ? { global: { headers: { [CHOICE_HEADER]: choice } } } : undefined);
}
