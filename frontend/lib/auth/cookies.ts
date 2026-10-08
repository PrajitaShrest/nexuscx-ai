// "Remember me": when it is NOT ticked, the session cookies are made
// browser-session cookies (no expiry), so closing the browser signs you out.
export const REMEMBER_COOKIE = "nx_remember";

type CookieOptions = { maxAge?: number; expires?: Date; [key: string]: unknown };

export function applyRemember<T extends CookieOptions>(options: T | undefined, remember: boolean): T | undefined {
  if (remember || !options) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest as T;
}

// Without "Remember me", a session also ends after 30 minutes with no activity.
// nx_seen holds the time of the last page request (browser-session cookie).
export const SEEN_COOKIE = "nx_seen";
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
