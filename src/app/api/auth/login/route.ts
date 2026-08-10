import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth-token";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

export async function POST(req: NextRequest) {
  const expectedEmail = process.env.AUTH_EMAIL?.trim().toLowerCase();
  const expectedPassword = process.env.AUTH_PASSWORD;
  if (!expectedEmail || !expectedPassword) {
    return NextResponse.json(
      { error: "Login isn't configured on the server (AUTH_EMAIL/AUTH_PASSWORD missing)" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (email !== expectedEmail || password !== expectedPassword) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
