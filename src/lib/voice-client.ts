// Client-only voice preferences — gender, language, and the live-update
// signal that ties them together. Read/written by voice-experience.tsx,
// the ambient widget, and now Settings (the single place these are meant
// to be changed from — see settings/page.tsx's Voice & AI section).

export type VoiceGender = "female" | "male";

const VOICE_GENDER_STORAGE_KEY = "tericvoice:voice-gender";

export function getVoiceGender(): VoiceGender {
  if (typeof window === "undefined") return "male";
  // Default is male — anything other than an explicit "female" falls back
  // to it, covering both "never set" and any stale/invalid stored value.
  return window.localStorage.getItem(VOICE_GENDER_STORAGE_KEY) === "female" ? "female" : "male";
}

export function setVoiceGender(gender: VoiceGender): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VOICE_GENDER_STORAGE_KEY, gender);
}

// Shared between voice-experience.tsx and the ambient widget — one list,
// so the two can't quietly drift apart.
export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
] as const;
export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["value"];

const VOICE_LANGUAGE_STORAGE_KEY = "tericvoice:voice-language";

export function getVoiceLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const raw = window.localStorage.getItem(VOICE_LANGUAGE_STORAGE_KEY);
  return LANGUAGE_OPTIONS.some((opt) => opt.value === raw) ? (raw as LanguageCode) : "en";
}

export function setVoiceLanguage(language: LanguageCode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, language);
}

// Fired whenever gender or language changes, from Settings or from a
// voice command — the always-on ambient widget listens for this to
// reconnect live with the new values. Needed because the native
// `storage` event only fires in *other* tabs, never the one that made
// the write, and the widget has no other way to hear about a same-tab
// localStorage change.
export const VOICE_PREFERENCE_CHANGED_EVENT = "tericvoice:voice-preference-changed";

export function announceVoicePreferenceChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VOICE_PREFERENCE_CHANGED_EVENT));
}
