export const LOGIN_PATH = "/";
export const AUTHENTICATED_HOME = "/dashboard";

export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const url = new URL(value, "http://local.invalid");
    if (url.origin !== "http://local.invalid" || url.pathname === LOGIN_PATH) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function loginPathFor(returnTo: string | null | undefined): string {
  const safe = safeReturnTo(returnTo);
  return safe ? `${LOGIN_PATH}?returnTo=${encodeURIComponent(safe)}` : LOGIN_PATH;
}
