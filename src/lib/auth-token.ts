// Signs/verifies the app's login-gate session cookie. Deliberately simple —
// this is one shared password protecting the deployed app from random
// visitors (and their cost to your ElevenLabs usage), not per-user
// authentication. Runs in both the login route (Node runtime) and
// middleware.ts (Edge runtime), so it only uses Web Crypto + plain JS —
// no Node-only APIs like `Buffer`, which Edge doesn't reliably provide.

export const SESSION_COOKIE_NAME = "teric_session";

const SESSION_PAYLOAD = "authenticated";

function getSecret(): string {
  // A dedicated secret is preferable, but falling back to the password
  // itself keeps setup to just AUTH_EMAIL/AUTH_PASSWORD for this basic a
  // gate — there's nothing else sensitive the signature is protecting.
  return (
    process.env.AUTH_SESSION_SECRET || process.env.AUTH_PASSWORD || "teric-voice-session-fallback"
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return toHex(signature);
}

/** Call after a successful email/password check to mint the cookie value. */
export async function createSessionToken(): Promise<string> {
  return `${SESSION_PAYLOAD}.${await sign(SESSION_PAYLOAD)}`;
}

/** True only for a token this server actually issued — a cookie someone
 * hand-crafted in devtools without knowing AUTH_PASSWORD won't verify. */
export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (payload !== SESSION_PAYLOAD || !signature) return false;
  return signature === (await sign(payload));
}
