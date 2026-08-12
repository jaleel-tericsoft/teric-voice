/** Chrome/Safari block audio.play() without a real click preceding it —
 * calling this from inside a real click handler (the voice-filling
 * screen's "Start" button, the login form's submit) unlocks autoplay for
 * the rest of the tab, so an agent's TTS playback isn't silently blocked
 * later (which otherwise looks exactly like "it isn't saying anything").
 * Shared between voice-experience.tsx and the login page, since the
 * ambient widget auto-connects right after login with no click of its
 * own to piggyback on. */
export function unlockAudioPlayback() {
  try {
    const a = new Audio();
    a.play().catch(() => {});
  } catch {
    // ignore — best-effort unlock
  }
}
