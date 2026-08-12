import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth-token";

// Gates the whole deployed app behind one shared login (see AUTH_EMAIL/
// AUTH_PASSWORD) — /login and the auth API routes are the only paths that
// don't require it. Covers /api/voice/* too, not just the UI pages: the
// entire point is keeping random visitors off routes that spend your
// ElevenLabs usage, so a curl straight at the API has to be blocked the
// same as loading a page in a browser.
//
// Named `proxy` (not `middleware`) per this Next.js version — the
// middleware.ts convention is deprecated in favor of proxy.ts, and it now
// defaults to the Node.js runtime rather than Edge.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (await isValidSessionToken(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
