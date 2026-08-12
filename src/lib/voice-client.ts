// Client-only voice preference, still read/written by voice-experience.tsx.
// Everything else that used to live here (TTS playback, transcription,
// answer/review-command interpretation, and the MicSession recorder with
// its hand-rolled silence detection) was the old OpenAI Whisper/GPT-4o-mini
// pipeline — fully superseded by the ElevenLabs Conversational AI agent
// (see voice-agent-prompt.ts) and removed as dead code.

export type VoiceGender = "female" | "male";

const VOICE_GENDER_STORAGE_KEY = "tericvoice:voice-gender";

export function getVoiceGender(): VoiceGender {
  if (typeof window === "undefined") return "female";
  return window.localStorage.getItem(VOICE_GENDER_STORAGE_KEY) === "male" ? "male" : "female";
}

export function setVoiceGender(gender: VoiceGender): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VOICE_GENDER_STORAGE_KEY, gender);
}

// Shared between voice-experience.tsx's own settings popover and the
// ambient widget's — one list, so the two can't quietly drift apart.
export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
] as const;
export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["value"];
