"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { performLogout } from "@/lib/logout";

// Same localStorage-preference convention as getVoiceGender/setVoiceGender
// in voice-client.ts — a plain string under a namespaced key, read
// defensively (window may not exist yet during SSR/first paint).
const IDLE_TIMEOUT_STORAGE_KEY = "tericvoice:idle-timeout-seconds";

export const IDLE_TIMEOUT_OPTIONS_SECONDS = [10, 30, 60, 90] as const;
export type IdleTimeoutSeconds = (typeof IDLE_TIMEOUT_OPTIONS_SECONDS)[number];
const DEFAULT_IDLE_TIMEOUT_SECONDS: IdleTimeoutSeconds = 30;

// A wearable/glasses device left running is easy to forget about, so this
// is the app-wide safety net — it does not run on /voice/[entryId], which
// sits outside the (app) layout and is already an actively-attended,
// immersive session in its own right.
export function getIdleTimeoutSeconds(): IdleTimeoutSeconds {
  if (typeof window === "undefined") return DEFAULT_IDLE_TIMEOUT_SECONDS;
  const raw = Number(window.localStorage.getItem(IDLE_TIMEOUT_STORAGE_KEY));
  return IDLE_TIMEOUT_OPTIONS_SECONDS.includes(raw as IdleTimeoutSeconds)
    ? (raw as IdleTimeoutSeconds)
    : DEFAULT_IDLE_TIMEOUT_SECONDS;
}

export function setIdleTimeoutSeconds(seconds: IdleTimeoutSeconds): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(IDLE_TIMEOUT_STORAGE_KEY, String(seconds));
}

// The final warning shouldn't outlast the countdown itself — at the
// shortest option (10s) a flat 30s warning window would cover the entire
// timeout, defeating the point of a "final stretch" notice. Scaled to a
// third of the total instead, with a 3s floor and the original 30s cap.
function warningWindowSeconds(totalSeconds: number): number {
  return Math.min(30, Math.max(3, Math.floor(totalSeconds / 3)));
}

// Activity is voice, not mouse/keyboard — this app is meant to be run
// hands-free, so someone actively talking with the ambient assistant
// (or being spoken to by it) shouldn't get logged out just because their
// hands never touched the mouse. A custom event rather than a shared
// store/context, same reasoning as VOICE_PREFERENCE_CHANGED_EVENT in
// voice-client.ts: the widget that hears the activity and this hook that
// tracks it don't otherwise share a parent worth wiring a prop through.
const VOICE_ACTIVITY_EVENT = "tericvoice:voice-activity";

export function recordVoiceActivity(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VOICE_ACTIVITY_EVENT));
}

const TICK_MS = 1000;

/** Tracks user activity app-wide and auto-logs-out after N idle seconds
 * (configurable in Settings). Returns the remaining seconds only once
 * inside the final warning window — null the rest of the time, so callers
 * can cheaply decide whether to render anything at all. */
export function useIdleLogout() {
  const router = useRouter();
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null);
  // Lazily seeded on the client inside an effect below rather than at
  // useRef(Date.now()) — reading the clock during render is an impure call
  // React explicitly disallows (react-hooks/purity).
  const lastActivityRef = useRef<number | null>(null);
  const loggingOutRef = useRef(false);

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setWarningSecondsLeft((prev) => (prev === null ? prev : null));
  }, []);

  useEffect(() => {
    // Seed the clock directly (no setState — warningSecondsLeft already
    // starts at null, so there's nothing to synchronize here) rather than
    // going through recordActivity, which the set-state-in-effect rule
    // rightly objects to being called synchronously from an effect body.
    lastActivityRef.current = Date.now();
    window.addEventListener(VOICE_ACTIVITY_EVENT, recordActivity);
    return () => window.removeEventListener(VOICE_ACTIVITY_EVENT, recordActivity);
  }, [recordActivity]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      if (loggingOutRef.current || lastActivityRef.current === null) return;
      const totalSeconds = getIdleTimeoutSeconds();
      const timeoutMs = totalSeconds * 1000;
      const idleMs = Date.now() - lastActivityRef.current;
      const remainingMs = timeoutMs - idleMs;

      if (remainingMs <= 0) {
        loggingOutRef.current = true;
        await performLogout();
        router.push("/login");
        router.refresh();
        return;
      }

      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const warnAt = warningWindowSeconds(totalSeconds);
      setWarningSecondsLeft(remainingSeconds <= warnAt ? remainingSeconds : null);
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [router]);

  return { warningSecondsLeft, stayLoggedIn: recordActivity };
}
