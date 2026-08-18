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
// DEVELOPMENT ONLY — lets the React Native app (TericVoiceMobile) fetch a
// signed agent URL without first obtaining a session cookie. The mobile app
// can't hold ELEVENLABS_API_KEY (an APK is a zip; anything bundled into it is
// readable), so it has to get its signed URL from this server, and it has no
// login screen yet.
//
// This is a real hole: anyone who can reach this server can spend the
// account's ElevenLabs credit. It is therefore hard-gated on NODE_ENV, so a
// production build cannot serve it however this deploys — `next build` sets
// NODE_ENV=production, so the exemption simply doesn't exist there.
//
// To close it properly: give the mobile app a login that calls
// /api/auth/login, store the returned cookie/token on the device, send it on
// this request, and delete this block along with VOICE_ENABLED's __DEV__ gate
// in the mobile app's src/lib/voiceConfig.ts.
// agent-token is the one the mobile app actually uses (React Native requires
// WebRTC); agent-session is listed too so the same exemption covers either
// transport while this is being developed.
const MOBILE_DEV_EXEMPT_PATHS = [
  "/api/voice/agent-token",
  "/api/voice/agent-session",
];

function isMobileDevExempt(pathname: string): boolean {
  return (
    process.env.NODE_ENV !== "production" && MOBILE_DEV_EXEMPT_PATHS.includes(pathname)
  );
}

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

  if (isMobileDevExempt(pathname)) {
    console.warn(
      `[proxy] serving ${pathname} unauthenticated — development-only mobile exemption`
    );
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
