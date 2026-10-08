import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { IDLE_LIMIT_MS, REMEMBER_COOKIE, SEEN_COOKIE, applyRemember } from "@/lib/auth/cookies";

// Pages anyone can open without signing in
const PUBLIC_PATHS = ["/login", "/signup", "/staff/login", "/forgot-password", "/auth/callback", "/terms", "/privacy"];

// Runs before every page: refreshes the session cookie and sends anyone
// who is not signed in to the right sign-in page.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const remember = request.cookies.get(REMEMBER_COOKIE)?.value !== "0";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, applyRemember(options, remember)),
          );
        },
      },
    },
  );

  // getClaims() verifies the token's signature; never trust the browser.
  const { data } = await supabase.auth.getClaims();
  let signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  const staffPath = ["/conversations", "/cases", "/users"].some((p) => path.startsWith(p));

  // Not "remembered" and idle for 30 minutes (or the browser restored an old tab): sign out.
  if (signedIn && !remember) {
    const seen = Number(request.cookies.get(SEEN_COOKIE)?.value ?? 0);
    if (seen && Date.now() - seen > IDLE_LIMIT_MS) {
      await supabase.auth.signOut();
      signedIn = false;
      if (!isPublic && !path.startsWith("/api")) {
        const url = request.nextUrl.clone();
        url.pathname = staffPath ? "/staff/login" : "/login";
        url.search = "?expired=1";
        const redirect = NextResponse.redirect(url);
        response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
        redirect.cookies.delete(SEEN_COOKIE);
        return redirect;
      }
      response.cookies.delete(SEEN_COOKIE);
    } else {
      response.cookies.set(SEEN_COOKIE, String(Date.now()), { httpOnly: true, sameSite: "lax", path: "/" });
    }
  }

  if (!signedIn && !isPublic && !path.startsWith("/api")) {
    const url = request.nextUrl.clone();
    url.pathname = staffPath ? "/staff/login" : "/login";
    return NextResponse.redirect(url);
  }
  return response;
}
