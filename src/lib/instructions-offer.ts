// One-shot hand-off from the login page to the ambient widget's very next
// connect: "this is a fresh login — offer the quick-instructions rundown
// once." sessionStorage (not localStorage), same reasoning as
// submission-announcement.ts — it needs to survive the one hop to the
// dashboard's first ambient connect and then self-clear, not persist as a
// real preference or fire again on a later reconnect within the same
// login (switching voices, leaving and returning to the form builder,
// etc. all reconnect the widget without this being "a new login").

const STORAGE_KEY = "tericvoice:pending-instructions-offer";

export function markJustLoggedIn(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, "true");
}

/** Reads and clears the flag in one step — the offer is made at most
 * once per login, not on every ambient reconnect after. */
export function consumePendingInstructionsOffer(): boolean {
  if (typeof window === "undefined") return false;
  const pending = window.sessionStorage.getItem(STORAGE_KEY) === "true";
  if (pending) window.sessionStorage.removeItem(STORAGE_KEY);
  return pending;
}
