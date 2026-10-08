// "Remember me": when it is NOT ticked, the session cookies are made
// browser-session cookies (no expiry), so closing the browser signs you out.
export const REMEMBER_COOKIE = "nx_remember";

type CookieOptions = { maxAge?: number; expires?: Date; [key: string]: unknown };

export function applyRemember<T extends CookieOptions>(options: T | undefined, remember: boolean): T | undefined {
  if (remember || !options) return options;
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  return rest as T;
}
