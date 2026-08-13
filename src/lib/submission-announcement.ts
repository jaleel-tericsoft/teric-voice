// A one-shot "mention this on your next opening line" note the
// form-filling agent leaves behind when a form gets submitted
// (voice-experience.tsx), for the ambient widget to pick up and read out
// the next time it connects — the two are separate ElevenLabs sessions
// (voice-experience.tsx's agent has already ended by the time the ambient
// widget reconnects on landing back on an (app) page), so this is the
// hand-off between them.
//
// sessionStorage, not localStorage: this is meant to survive exactly one
// hop (submit -> land back on an authenticated page), not persist as a
// real preference — clearing itself once read is what makes it "only
// mentioned once", and sessionStorage clearing itself when the tab closes
// is a reasonable second line of defense against a stale leftover.

const KEY = "tericvoice:pending-submission-announcement";

export function markFormSubmitted(formName: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, formName);
}

/** Reads and clears the pending announcement in one step — call this at
 * most once per connect, since reading it a second time should find
 * nothing left to say. */
export function consumePendingSubmissionAnnouncement(): string | null {
  if (typeof window === "undefined") return null;
  const formName = window.sessionStorage.getItem(KEY);
  if (formName) window.sessionStorage.removeItem(KEY);
  return formName;
}
