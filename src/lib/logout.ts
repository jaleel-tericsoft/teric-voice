// Shared by the sidebar's Logout button and the idle-timeout auto-logout —
// both need the exact same "clear the session cookie server-side" step.
// Doesn't handle the redirect itself (that needs `useRouter()`, a hook, so
// it has to stay with each caller) — just the fetch.
export async function performLogout(): Promise<void> {
  // Clears the session cookie server-side — without this, navigating to
  // /login would leave the cookie valid, so the proxy would let you
  // straight back in without re-entering the password.
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}
