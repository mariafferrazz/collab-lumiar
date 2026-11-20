import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const protectedPrefixes = ["/minha-conta", "/admin"];

export function proxy(request: NextRequest) {
  const isProtected = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request, { cookiePrefix: "collab" });

  if (!sessionCookie) {
    const signInURL = new URL("/entrar", request.url);
    signInURL.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(signInURL);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/minha-conta/:path*", "/admin/:path*"],
};
