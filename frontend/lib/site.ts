import { headers } from "next/headers";

// The public address of the app, used in links inside emails (password reset, invites).
// Online: set NEXT_PUBLIC_SITE_URL (e.g. https://nexuscx-ai.vercel.app) in the hosting settings.
// Otherwise it is worked out from the request, so it also works on a laptop and on preview links.
export async function siteUrl(): Promise<string> {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (fixed) return fixed;
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  return "http://localhost:3000";
}
