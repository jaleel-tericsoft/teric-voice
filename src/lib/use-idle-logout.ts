"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { performLogout } from "@/lib/logout";

// Same localStorage-preference convention as getVoiceGender/setVoiceGender
// in voice-client.ts — a plain string under a namespaced key, read
// defensively (window may not exist yet during SSR/first paint).
const IDLE_TIMEOUT_STORAGE_KEY = "tericvoice:idle-timeout-minutes";

export const IDLE_TIMEOUT_OPTIONS_MINUTES = [1, 2, 5] as const;
export type IdleTimeoutMinutes = (typeof IDLE_TIMEOUT_OPTIONS_MINUTES)[number];
const DEFAULT_IDLE_TIMEOUT_MINUTES: IdleTimeoutMinutes = 5;

// A wearable/glasses device left running is easy to forget about, so this
// is the app-wide safety net — it does not run on /voice/[entryId], which
// sits outside the (app) layout and is already an actively-attended,
// immersive session in its own right.
export function getIdleTimeoutMinutes(): IdleTimeoutMinutes {
  if (typeof window === "undefined") return DEFAULT_IDLE_TIMEOUT_MINUTES;
  const raw = Number(window.localStorage.getItem(IDLE_TIMEOUT_STORAGE_KEY));
  return IDLE_TIMEOUT_OPTIONS_MINUTES.includes(raw as IdleTimeoutMinutes)
    ? (raw as IdleTimeoutMinutes)
    : DEFAULT_IDLE_TIMEOUT_MINUTES;
}

export function setIdleTimeoutMinutes(minutes: IdleTimeoutMinutes): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(IDLE_TIMEOUT_STORAGE_KEY, String(minutes));
}

// Only the final stretch before logout should be visible — anything wider
// and the countdown becomes a permanent, distracting fixture instead of a
// "you're about to be logged out" warning. Matches the plan's agreed UX.
const WARNING_WINDOW_SECONDS = 30;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;
const TICK_MS = 1000;

/** Tracks user activity app-wide and auto-logs-out after N idle minutes
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
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, recordActivity, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, recordActivity);
      }
    };
  }, [recordActivity]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      if (loggingOutRef.current || lastActivityRef.current === null) return;
      const timeoutMs = getIdleTimeoutMinutes() * 60 * 1000;
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
      setWarningSecondsLeft(remainingSeconds <= WARNING_WINDOW_SECONDS ? remainingSeconds : null);
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [router]);

  return { warningSecondsLeft, stayLoggedIn: recordActivity };
}
