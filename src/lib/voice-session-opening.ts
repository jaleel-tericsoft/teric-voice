// Powers the "who's talking + something fresh to start the day" opening
// line, spoken once at the start of every voice session (see
// buildFirstMessage in voice-agent-prompt.ts). Two pieces:
//   1. A name for each voice persona, so the assistant can introduce
//      itself instead of staying anonymous.
//   2. A quote that's motivational the very first time someone opens the
//      app in a day, and just "fresh" (not repeated) on every session
//      after that — tracked in localStorage, same convention as the other
//      client-only preferences in this app (see voice-client.ts).

import type { VoiceGender } from "@/lib/voice-client";

export const ASSISTANT_NAMES: Record<VoiceGender, string> = {
  female: "Ava",
  male: "Leo",
};

export function getAssistantName(gender: VoiceGender): string {
  return ASSISTANT_NAMES[gender];
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

const GENERAL_QUOTES = [
  "Simple is often the smartest way to get things done.",
  "Clarity beats perfection every time.",
  "The best time to start was earlier — the next best time is now.",
  "Good things happen when you keep showing up.",
  "A tidy record today saves a headache tomorrow.",
  "Little and often beats all at once.",
  "Done is better than perfect.",
  "Every detail you capture now is a favor to future you.",
  "Keep it simple, keep it moving.",
  "Small effort, steady result.",
  "Consistency is quietly powerful.",
  "One form down is still progress.",
];

const STORAGE_KEY = "tericvoice:daily-opening";

interface StoredOpeningState {
  date: string; // YYYY-MM-DD, local
  usedGeneral: number[]; // GENERAL_QUOTES indexes already spoken today
}

export interface DailyOpening {
  quote: string;
  isFirstSessionToday: boolean;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readState(): StoredOpeningState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredOpeningState) : null;
  } catch {
    return null;
  }
}

function writeState(state: StoredOpeningState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Call once per voice session (not per reconnect — see the ref-caching in
 * voice-experience.tsx) to get this session's opening quote. The first
 * call of the calendar day always draws from the motivational pool; every
 * call after that, same day, draws a quote from the general pool that
 * hasn't been used yet today, recycling only once the pool runs dry.
 * Resets itself automatically at midnight since the stored date won't
 * match "today" anymore. */
export function getDailyOpeningQuote(): DailyOpening {
  const today = todayIso();
  const state = readState();

  if (!state || state.date !== today) {
    writeState({ date: today, usedGeneral: [] });
    const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    return { quote, isFirstSessionToday: true };
  }

  const available = GENERAL_QUOTES.map((_, i) => i).filter((i) => !state.usedGeneral.includes(i));
  const pool = available.length > 0 ? available : GENERAL_QUOTES.map((_, i) => i);
  const idx = pool[Math.floor(Math.random() * pool.length)];
  const usedGeneral = available.length > 0 ? [...state.usedGeneral, idx] : [idx];
  writeState({ date: today, usedGeneral });
  return { quote: GENERAL_QUOTES[idx], isFirstSessionToday: false };
}
