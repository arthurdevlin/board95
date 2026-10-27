import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed middleware.ts to proxy.ts and the exported function to
// "proxy". This runs before every matched request, on the edge, so it can't
// use Prisma directly — it only checks for the session cookie's presence.
// The real check (is the session still valid?) happens on the page itself
// via getSession(), which is the one that can be trusted.
const SESSION_COOKIE = "better-auth.session_token";

export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);

  if (!hasSessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*"],
};
