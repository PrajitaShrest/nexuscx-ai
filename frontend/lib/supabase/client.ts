import { createBrowserClient } from "@supabase/ssr";

// Supabase client for code running in the browser (photo uploads, live chat updates).
// It uses the same signed-in session as the server, so Row Level Security still applies.
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
