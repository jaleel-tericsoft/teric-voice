// Powers the "who's talking + a fresh quote to start the day" opening
// line, spoken once at the start of a voice session (see buildFirstMessage
// in voice-agent-prompt.ts and buildAmbientFirstMessage in
// ambient-agent-prompt.ts). Two pieces:
//   1. A name for each voice persona, so the assistant can introduce
//      itself instead of staying anonymous.
//   2. A motivational quote — said once, on the very first voice session
//      of the calendar day (almost always the ambient widget's own
//      opening greeting right after login), and never repeated again that
//      day regardless of how many more sessions happen — tracked in
//      localStorage, same convention as the other client-only preferences
//      in this app (see voice-client.ts).

import type { VoiceGender } from "@/lib/voice-client";

export const ASSISTANT_NAMES: Record<VoiceGender, string> = {
  female: "Ava",
  male: "Leo",
};

export function getAssistantName(gender: VoiceGender): string {
  return ASSISTANT_NAMES[gender];
}

/** "Good morning" / "Good afternoon" / "Good evening" off the local clock
 * — used to open every voice session (form-filling or ambient) instead of
 * a flat, time-blind "Hi there". */
export function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const MOTIVATIONAL_QUOTES = [
  "Small steps, done consistently, add up to something big.",
  "You don't have to see the whole staircase, just the next step.",
  "Progress, not perfection.",
  "Today's a good day to get one more thing done.",
  "A little momentum goes a long way — let's get going.",
  "Nice and steady wins the day.",
  "One question at a time, one form at a time.",
  "You've got this — let's make it quick and easy.",
  "Fresh day, fresh start.",
  "Every entry finished is one less thing on your mind.",
];

const STORAGE_KEY = "tericvoice:daily-opening";

export interface DailyOpening {
  /** null once today's quote has already been used — callers should
   * simply omit the quote line entirely in that case, not fall back to
   * some other quote. */
  quote: string | null;
  isFirstSessionToday: boolean;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getStoredDate(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function setStoredDate(date: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, date);
}

/** Call once per voice session (not per reconnect — see the ref-caching in
 * voice-experience.tsx and ambient-voice-widget.tsx) to find out whether
 * this session should open with a quote. Only the first call of the
 * calendar day gets one; every call after that, same day, gets none at
 * all. Resets itself automatically at midnight since the stored date
 * won't match "today" anymore. */
export function getDailyOpeningQuote(): DailyOpening {
  const today = todayIso();
  if (getStoredDate() === today) {
    return { quote: null, isFirstSessionToday: false };
  }
  setStoredDate(today);
  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  return { quote, isFirstSessionToday: true };
}

/** Spoken the moment a session reconnects with a *different* voice
 * (switch_voice, on either the ambient widget or the form-filling
 * screen) — a proper reintroduction with the day's time-of-day wishes,
 * not just a bare "back with you". Deliberately excludes the daily
 * quote (still at most once a day, whichever session happens to get
 * there first) and any once-per-login extras (instructions offer,
 * submission announcement) — those are one-shot and already spent or
 * still pending for a later, non-voice-switch reconnect. */
export function buildVoiceSwitchedMessage(assistantName: string): string {
  const greetingWord = timeOfDayGreeting();
  return `Hi, I'm now speaking as ${assistantName}. ${greetingWord}! Hope you're doing well.`;
}
