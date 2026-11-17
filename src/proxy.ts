import { NextResponse, type NextRequest } from "next/server";

import { loginPathFor } from "@/features/mvp/authentication-navigation";
import { SESSION_COOKIE_NAME } from "@/features/mvp/session-authentication";

function isPublicPath(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/_next/") || pathname.startsWith("/api/")
    || pathname === "/favicon.ico" || /\.[a-z0-9]+$/iu.test(pathname);
}

export function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value.trim()) {
    return NextResponse.redirect(new URL(loginPathFor(returnTo), request.url));
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-saulo-ai-return-to", returnTo);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
