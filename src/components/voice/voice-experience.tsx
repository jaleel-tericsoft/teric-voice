"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import {
  X,
  Mic,
  MicOff,
  Settings2,
  CheckCheck,
  AlertTriangle,
  Save,
} from "lucide-react";
import { VoiceOrb, type OrbState } from "@/components/voice/voice-orb";
import { LiveFormPanel, type AnswerMap } from "@/components/voice/live-form-panel";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAllQuestions, getSections, findQuestion, findSectionByVoice } from "@/lib/form-utils";
import {
  getVoiceGender,
  setVoiceGender,
  LANGUAGE_OPTIONS,
  type VoiceGender,
  type LanguageCode,
} from "@/lib/voice-client";
import { buildAgentPrompt, buildFirstMessage } from "@/lib/voice-agent-prompt";
import { getAssistantName, getDailyOpeningQuote } from "@/lib/voice-session-opening";
import { unlockAudioPlayback } from "@/lib/audio-unlock";
import { validateAnswer, canSkip } from "@/lib/voice-agent-validate";
import { markFormSubmitted } from "@/lib/submission-announcement";
import { performLogout } from "@/lib/logout";
import { useEntriesStore } from "@/lib/entries-store";
import { currentUser } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { Entry, EntryAnswer, FormDefinition, FormQuestion } from "@/types";

// ElevenLabs' well-known premade voices — same pair the old plain-TTS route
// used, now selected client-side via overrides.tts.voiceId per session
// instead of a server-side request body field.
const FEMALE_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const MALE_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam

let entryIdCounter = 0;
function generateEntryId(): string {
  entryIdCounter += 1;
  return `ENT-${Date.now().toString(36).toUpperCase()}${entryIdCounter}`;
}

/** Converts the live in-memory answer map into the persisted Entry shape —
 * shared between "Save Draft & Exit" and the final submit, the only
 * difference being the status/timestamps passed in. */
function buildEntry(params: {
  id: string;
  form: FormDefinition;
  answers: AnswerMap;
  status: Entry["status"];
  createdAt: string;
  previous?: Entry;
}): Entry {
  const { id, form, answers, status, createdAt, previous } = params;
  const now = new Date().toISOString();
  const entryAnswers: EntryAnswer[] = Object.entries(answers)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([fieldName, value]) => {
      const prior = previous?.answers.find((a) => a.fieldName === fieldName);
      return (
        prior && prior.value === value
          ? prior // keep original provenance/confidence if unchanged
          : { fieldName, value: value as string | boolean, source: "voice", manuallyCorrected: false, timestamp: now }
      );
    });

  return {
    id,
    formId: form.id,
    formName: form.name,
    formVersion: form.currentVersion,
    status,
    createdBy: currentUser.name,
    createdAt,
    submittedAt: status === "submitted" ? now : previous?.submittedAt,
    answers: entryAnswers,
    pdf: previous?.pdf ?? { status: "not_generated" },
    email: previous?.email ?? { status: "not_sent", recipient: "" },
    voiceSession: previous?.voiceSession,
    audit: [
      ...(previous?.audit ?? [
        { id: "a1", type: "session_started" as const, message: "Voice session started", timestamp: createdAt, actor: currentUser.name },
      ]),
      status === "submitted"
        ? { id: `a_${Date.now()}`, type: "entry_created" as const, message: "Entry submitted", timestamp: now, actor: currentUser.name }
        : { id: `a_${Date.now()}`, type: "field_manually_edited" as const, message: "Saved as draft", timestamp: now, actor: currentUser.name },
    ],
  };
}

type MessageLine = { text: string; kind: "sentence" | "option" };

/** Reformats one spoken assistant turn for display: one sentence per line
 * instead of a single dense paragraph. Speech itself is unaffected; this
 * only changes what's rendered. */
function formatSpokenMessage(text: string): MessageLine[] {
  if (!text.trim()) return [];
  return text
    .split(/(?<=[.!?])\s+(?=["A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((sentence) => ({ text: sentence, kind: "sentence" as const }));
}

/** Turns a raw record_answer value into the way it should be spoken back to
 * the user — a single_select/multi_select's real label(s) rather than its
 * internal value, "Yes"/"No" for booleans. Used to make the tool's own
 * response state exactly what was recorded, deterministically, rather than
 * leaving the agent to remember/restate it from its own context. */
function describeAnswerValue(q: FormQuestion, value: string | boolean): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (q.fieldType === "single_select") {
    return q.options?.find((o) => o.value === value)?.label ?? String(value);
  }
  if (q.fieldType === "multi_select") {
    return String(value)
      .split(",")
      .map((v) => q.options?.find((o) => o.value === v)?.label ?? v)
      .join(", ");
  }
  return String(value);
}

/** useConversation() needs a ConversationProvider ancestor — colocated here
 * rather than at the page level since this is the only place it's used. */
export function VoiceExperience(props: { form: FormDefinition; resumeEntry?: Entry }) {
  return (
    <ConversationProvider>
      <VoiceExperienceInner {...props} />
    </ConversationProvider>
  );
}

function VoiceExperienceInner({
  form,
  resumeEntry,
}: {
  form: FormDefinition;
  /** When set, this is a previously saved draft/in-progress entry being
   * continued rather than a fresh one — its answers pre-fill the form and
   * the agent is told (via the prompt) to skip straight to the first
   * unanswered field. */
  resumeEntry?: Entry;
}) {
  const router = useRouter();
  const { upsertEntry } = useEntriesStore();
  // Stable across the whole session (including any number of draft saves)
  // so re-saving or finally submitting always updates the same entry
  // instead of creating duplicates.
  const entryIdRef = useRef(resumeEntry?.id ?? generateEntryId());
  const createdAtRef = useRef(resumeEntry?.createdAt ?? new Date().toISOString());

  /** Persists whatever's been answered so far as an in-progress entry and
   * exits — the entry shows up in Entries with a "Resume" action that
   * reopens this exact session. Takes the answers explicitly rather than
   * reading `answers` state directly, since the client tool closures only
   * ever see the ref snapshot from when the session started, not a fresh
   * render each call. */
  const saveDraftAndExit = useCallback(
    (currentAnswers: AnswerMap) => {
      const entry = buildEntry({
        id: entryIdRef.current,
        form,
        answers: currentAnswers,
        status: "in_progress",
        createdAt: createdAtRef.current,
        previous: resumeEntry,
      });
      upsertEntry(entry);
      router.push("/entries");
    },
    [form, resumeEntry, upsertEntry, router]
  );

  const [phase, setPhase] = useState<"conversation" | "review" | "submitting">(
    "conversation"
  );
  const [assistantText, setAssistantText] = useState("");
  // Which field the agent is currently asking about (set by the
  // announce_question tool, right before it speaks each question).
  const [activeField, setActiveField] = useState<string | null>(null);
  // Briefly flashes a field in the form preview when an answer/correction
  // lands on it — takes priority over activeField while it's showing.
  const [highlightField, setHighlightField] = useState<string | null>(null);
  // Set by the voice-triggered go_silent/resume_speaking tools — distinct
  // from the manual mute button below (which cuts the mic entirely, so it
  // could never hear "unmute"). This instead silences the assistant's own
  // output (conversation.setVolume) while leaving the mic live, so it can
  // still hear the word to resume. Same pattern as ambient-voice-widget.tsx.
  const [silenced, setSilenced] = useState(false);
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    if (!resumeEntry) return {};
    const map: AnswerMap = {};
    for (const a of resumeEntry.answers) {
      if (typeof a.value === "string" || typeof a.value === "boolean") map[a.fieldName] = a.value;
    }
    return map;
  });
  // Every field the agent has asked about (answered or skipped) this
  // session — once every currently-visible question is in here, the form's
  // done and it's time to move to review. Mirrors the old
  // visitedFieldNamesRef, just driven by tool calls instead of a manual
  // question loop.
  const [visitedFieldNames, setVisitedFieldNames] = useState<Set<string>>(
    () => new Set(Object.keys(answers))
  );
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [voiceGender, setVoiceGenderState] = useState<VoiceGender>(() => getVoiceGender());

  // Client tool closures run inside the SDK's own event handling, not a
  // React render — they need refs to see current state, the same pattern
  // this component has always used for its long-running async work.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  const voiceGenderRef = useRef(voiceGender);
  useEffect(() => {
    voiceGenderRef.current = voiceGender;
    setVoiceGender(voiceGender);
  }, [voiceGender]);
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  // The conversation object changes identity on essentially every render
  // (its own mode/status are part of what triggers those renders), so
  // clientTools (see below — now memoized for the whole component's
  // lifetime, needed once this auto-connects instead of waiting for a
  // click) has to reach it through this instead of closing over
  // `conversation` directly.
  const conversationRef = useRef<ReturnType<typeof useConversation> | null>(null);

  // The day's opening quote is picked once per session (first connect),
  // not re-rolled on a switch_voice reconnect — only the assistant's name
  // should change when the voice switches, not the quote it already
  // opened with a moment ago.
  const dailyOpeningRef = useRef<ReturnType<typeof getDailyOpeningQuote> | null>(null);

  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashHighlight = useCallback((fieldName: string) => {
    setHighlightField(fieldName);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlightField(null), 2200);
  }, []);
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const markVisited = useCallback((fieldName: string) => {
    setVisitedFieldNames((prev) => {
      if (prev.has(fieldName)) return prev;
      const next = new Set(prev);
      next.add(fieldName);
      return next;
    });
  }, []);

  // Previously an inline object literal recreated fresh on every render —
  // memoized for the same reason ambient-voice-widget.tsx's clientTools
  // is: this session now auto-connects on mount instead of waiting for a
  // click, and an unstable clientTools/config identity is what caused the
  // ambient widget to tear down and re-establish its connection on
  // essentially every render (see that file's comment for the full
  // story). Every handler below reads current data through a ref (or a
  // stable setState setter) rather than a closed-over value, so "stable
  // forever" is safe here rather than "frozen with stale data forever".
  const clientTools = useMemo(
    () => ({
      announce_question: async (params: { field_name?: string }) => {
        const fieldName = params.field_name;
        if (!fieldName || !findQuestion(form, fieldName)) {
          return "Unknown field_name — it must exactly match one of the field names given in your instructions.";
        }
        setActiveField(fieldName);
        return "ok";
      },
      go_to_section: async (params: { section?: string }) => {
        if (!params.section?.trim()) return "Which section would you like to jump to?";
        const section = findSectionByVoice(form, params.section);
        if (!section) {
          const names = getSections(form)
            .map((s) => s.title)
            .join(", ");
          return `I couldn't find a section called "${params.section}". The sections are: ${names}.`;
        }
        const nextQuestion = section.questions.find((q) => {
          const value = answersRef.current[q.fieldName];
          return value === undefined || value === "";
        });
        if (!nextQuestion) {
          return `Everything in the ${section.title} section is already filled in — want to move on, or change something there?`;
        }
        // Already does what announce_question would do for this question —
        // no need for the agent to call that separately right after this.
        setActiveField(nextQuestion.fieldName);
        return `Switched to the ${section.title} section. Ask: "${nextQuestion.questionText}"`;
      },
      record_answer: async (params: { field_name?: string; value?: string }) => {
        const fieldName = params.field_name;
        const q = fieldName ? findQuestion(form, fieldName) : undefined;
        if (!fieldName || !q) {
          return "Unknown field_name — it must exactly match one of the field names given in your instructions.";
        }
        const result = validateAnswer(q, params.value ?? "");
        markVisited(fieldName);
        if (!result.ok) return result.reason;

        const previousValue = answersRef.current[fieldName];
        const isCorrection =
          previousValue !== undefined && previousValue !== "" && previousValue !== result.value;

        setAnswers((prev) => ({ ...prev, [fieldName]: result.value }));
        flashHighlight(fieldName);

        const spokenValue = describeAnswerValue(q, result.value);
        if (isCorrection) {
          return `Updated — changed from "${describeAnswerValue(q, previousValue)}" to "${spokenValue}".`;
        }
        return `Recorded: ${spokenValue}.`;
      },
      skip_field: async (params: { field_name?: string }) => {
        const fieldName = params.field_name;
        const q = fieldName ? findQuestion(form, fieldName) : undefined;
        if (!fieldName || !q) {
          return "Unknown field_name — it must exactly match one of the field names given in your instructions.";
        }
        const result = canSkip(q);
        markVisited(fieldName);
        if (!result.ok) return result.reason;
        return "Skipped.";
      },
      switch_voice: async (params: { gender?: string }) => {
        const gender: VoiceGender | null =
          params.gender === "male" ? "male" : params.gender === "female" ? "female" : null;
        if (!gender) return 'Unknown gender — must be "male" or "female".';
        setVoiceGenderState(gender);
        // Give the current session a moment to actually speak this tool's
        // return value before endSession/startSession tears it down and
        // reconnects — there's no live voice-swap primitive in the SDK, a
        // fresh session with a new overrides.tts.voiceId is the only way.
        window.setTimeout(() => {
          conversationRef.current?.endSession();
          connectSession(gender);
        }, 600);
        return `Switching to a ${gender} voice now.`;
      },
      go_silent: async () => {
        setSilenced(true);
        conversationRef.current?.setVolume({ volume: 0 });
        return "ok";
      },
      resume_speaking: async () => {
        setSilenced(false);
        conversationRef.current?.setVolume({ volume: 1 });
        return "I'm back.";
      },
      save_draft_and_exit: async () => {
        saveDraftAndExit(answersRef.current);
        return "Saved as a draft.";
      },
      discard_entry: async () => {
        // Deliberately does NOT call upsertEntry — the whole point is
        // nothing gets saved, unlike save_draft_and_exit. Avoids leaving
        // behind a pile of empty/near-empty draft entries from sessions
        // someone just didn't want to continue.
        router.push("/entries");
        return "Discarded.";
      },
      // Used for both an explicit spoken "log me out" (confirmed by the
      // prompt first) and the forced idle-silence timeout below — either
      // way, whatever's been answered so far is preserved as a draft
      // first, same as save_draft_and_exit, just followed by an actual
      // application logout instead of a plain return to /entries.
      logout: async () => {
        if (Object.keys(answersRef.current).length > 0) {
          const entry = buildEntry({
            id: entryIdRef.current,
            form,
            answers: answersRef.current,
            status: "in_progress",
            createdAt: createdAtRef.current,
            previous: resumeEntry,
          });
          upsertEntry(entry);
        }
        await performLogout();
        router.push("/login");
        router.refresh();
        return "Logging out now.";
      },
      submit_form: async () => {
        setPhase("submitting");
        const entry = buildEntry({
          id: entryIdRef.current,
          form,
          answers: answersRef.current,
          status: "submitted",
          createdAt: createdAtRef.current,
          previous: resumeEntry,
        });
        upsertEntry(entry);
        // The ambient widget mentions this once, on its next connect —
        // it's a separate agent session that starts fresh once the user
        // lands back on an authenticated page.
        markFormSubmitted(form.name);
        router.push(`/entries/${entry.id}`);
        return "Submitted.";
      },
    }),
    // Deliberately empty — see the comment above clientTools.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const conversation = useConversation({
    onMessage: ({ message, role }) => {
      if (role === "agent") setAssistantText(message);
    },
    onError: (message) => {
      console.error("[voice] agent session error", message);
      setSessionError(`${message} — you can still fill out the form manually on the right.`);
    },
    onDisconnect: (details) => {
      if (details.reason === "error") {
        setSessionError(`${details.message} — you can still fill out the form manually on the right.`);
      }
    },
    clientTools,
  });
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  const orbState: OrbState =
    phase === "submitting"
      ? "idle"
      : conversation.status === "connecting"
        ? "thinking"
        : conversation.mode === "speaking"
          ? "speaking"
          : "listening";

  // Derived, not effect-driven: once every currently-visible question has
  // been asked about (answered or skipped), the agent is expected to move
  // into its own summary/confirm step, so the UI flips to review in step
  // with that. Computed straight from render-time state (React's own
  // recommended pattern for "adjust state when derived inputs change")
  // rather than a useEffect — setPhase only fires while phase is still
  // "conversation", so this can't loop once it flips.
  //
  // The session-error fallback covers the same transition a different way:
  // if the agent session never worked, let a manual fill-in still unlock
  // review once every required visible field is set by hand.
  if (phase === "conversation") {
    const visible = getAllQuestions(form).filter(
      (q) => !q.conditional || answers[q.conditional.dependsOnFieldName] === q.conditional.equals
    );
    const allVisited = visible.length > 0 && visible.every((q) => visitedFieldNames.has(q.fieldName));
    const stillMissingRequired = visible.some((q) => {
      const answered = answers[q.fieldName] !== undefined && answers[q.fieldName] !== "";
      return q.required && !answered;
    });
    if (allVisited || (sessionError && !stillMissingRequired)) {
      setPhase("review");
    }
  }

  // A function declaration (not `const`) so it's hoisted — the switch_voice
  // client tool above references it before this line runs, but by the time
  // that tool actually gets called (a live tool call, long after this
  // render finished), the hoisted declaration is fully defined. Also used
  // directly by the auto-connect mount effect below. Only ever talks to
  // the SDK through conversationRef (not the closed-over `conversation`)
  // for the same reason clientTools is memoized — switch_voice's
  // reference to this function is itself effectively "frozen" at
  // first-render, so anything it touches has to be ref-safe too.
  async function connectSession(voiceGenderOverride?: VoiceGender) {
    try {
      const res = await fetch("/api/voice/agent-session");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.error || "Couldn't start a voice session");
      }
      const { signedUrl } = await res.json();
      const gender = voiceGenderOverride ?? voiceGenderRef.current;
      const voiceId = gender === "male" ? MALE_VOICE_ID : FEMALE_VOICE_ID;
      const assistantName = getAssistantName(gender);
      if (!dailyOpeningRef.current) dailyOpeningRef.current = getDailyOpeningQuote();
      await conversationRef.current?.startSession({
        signedUrl,
        overrides: {
          agent: {
            prompt: { prompt: buildAgentPrompt(form, answersRef.current, assistantName) },
            firstMessage: buildFirstMessage(form, answersRef.current, {
              assistantName,
              quote: dailyOpeningRef.current.quote,
            }),
            language: languageRef.current,
          },
          tts: { voiceId },
        },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setSessionError(`${reason} — you can still fill out the form manually on the right.`);
    }
  }

  useEffect(() => {
    // Auto-connects the moment this screen mounts — no "Start Voice
    // Entry" click needed. unlockAudioPlayback() is a best-effort call
    // here (there's no click to attach it to, unlike before): in
    // practice the ambient widget already proved a real ElevenLabs
    // session doesn't need the click-gesture unlock plain <audio>
    // autoplay does, since it's been auto-starting the same way since
    // login's own click — this just covers the rarer case of landing
    // here without ever having triggered that.
    //
    // Deferred by a tick (and cancellable) for the same reason as the
    // ambient widget's mount effect: React StrictMode's dev-only
    // mount→cleanup→mount double-invoke otherwise calls endSession()
    // while the real connect is still in flight, and the SDK appears to
    // honor that disconnect the moment the connection actually finishes
    // a beat later — surfacing as "connects, starts speaking, then
    // immediately disconnects" on every fresh load.
    unlockAudioPlayback();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) connectSession();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      conversationRef.current?.endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allQuestions = getAllQuestions(form);
  const visibleCount = allQuestions.filter(
    (q) =>
      !q.conditional || answers[q.conditional.dependsOnFieldName] === q.conditional.equals
  ).length;
  const answeredCount = Object.keys(answers).length;
  const progress = Math.min(100, Math.round((answeredCount / Math.max(visibleCount, 1)) * 100));

  function handleManualChange(fieldName: string, value: string | boolean) {
    setAnswers((prev) => ({ ...prev, [fieldName]: value }));
  }

  function handleSaveDraft() {
    saveDraftAndExit(answers);
  }

  function handleCancel() {
    // Deliberately does NOT save anything — same as the discard_entry
    // voice tool, and for the same reason: avoids leaving behind a pile
    // of empty/near-empty draft entries from sessions someone just wanted
    // to back out of.
    router.push("/entries");
  }

  async function handleSubmit() {
    setPhase("submitting");
    const entry = buildEntry({
      id: entryIdRef.current,
      form,
      answers,
      status: "submitted",
      createdAt: createdAtRef.current,
      previous: resumeEntry,
    });
    upsertEntry(entry);
    await new Promise((r) => setTimeout(r, 1300));
    router.push(`/entries/${entry.id}`);
  }

  const statusLabel =
    phase === "review"
      ? "Ready for review"
      : conversation.status === "connecting"
        ? "Connecting…"
        : silenced
          ? 'Silenced — say "unmute"'
          : conversation.mode === "speaking"
            ? "Speaking…"
            : "Listening…";

  return (
    <div className="flex h-dvh w-full flex-col gap-3 bg-canvas p-3">
      {/* Split panels */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* Left: voice panel */}
        <div className="relative flex flex-col overflow-hidden rounded-3xl bg-[#0b1f33] text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(120% 90% at 50% -10%, rgba(255,255,255,0.06), transparent 60%)",
            }}
          />

          <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-8 py-10">
            {sessionError ? (
              <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-warning/20 text-warning">
                  <AlertTriangle className="size-6" />
                </span>
                <p className="text-sm text-white/70">{sessionError}</p>
              </div>
            ) : (
              <VoiceOrb state={orbState} size={196} />
            )}

            <div className="flex max-w-md flex-col items-center gap-3 text-center">
              {!sessionError && (
                <div key={assistantText} className="animate-fade-in-up flex flex-col items-center gap-1.5">
                  {formatSpokenMessage(assistantText).map((line, i) =>
                    line.kind === "option" ? (
                      <span
                        key={i}
                        className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85"
                      >
                        {line.text}
                      </span>
                    ) : (
                      <p key={i} className="text-sm leading-snug font-semibold text-white">
                        {line.text}
                      </p>
                    )
                  )}
                </div>
              )}
            </div>

            {!sessionError && (
              <span className="text-xs font-medium uppercase tracking-wide text-white/40">
                {conversation.isMuted ? "Muted" : statusLabel}
              </span>
            )}
          </div>

          {/* Control bar */}
          {!sessionError && (
            <div className="relative flex items-center justify-center gap-3 pb-8">
              <button
                onClick={() => router.push("/entries")}
                className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="End session without saving"
                title="Exit without saving"
              >
                <X className="size-[18px]" />
              </button>
              <button
                onClick={() => conversation.setMuted(!conversation.isMuted)}
                className={cn(
                  "flex size-14 items-center justify-center rounded-full transition-colors",
                  conversation.isMuted ? "bg-white/15 text-white" : "bg-teal text-teal-foreground"
                )}
                aria-label={conversation.isMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {conversation.isMuted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                    aria-label="Voice settings"
                  >
                    <Settings2 className="size-[18px]" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" side="top" className="w-64 border-none bg-background">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Spoken language
                      </span>
                      <Select
                        value={language}
                        onValueChange={(v) => setLanguage(v as LanguageCode)}
                      >
                        <SelectTrigger className="h-9 w-full rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Applies to the next session — start again after changing this mid-call.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Assistant voice
                      </span>
                      <Select
                        value={voiceGender}
                        onValueChange={(v) => setVoiceGenderState(v as VoiceGender)}
                      >
                        <SelectTrigger className="h-9 w-full rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Applies to the next session, and is remembered on this device.
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Right: live form */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-background">
          <div className="flex shrink-0 flex-col gap-2 border-b border-border/60 px-6 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">
                {phase === "review" ? "Review your answers" : "Form Preview"}
              </h2>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="bg-muted [&>*]:bg-lime" />
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto px-6 py-5">
            <LiveFormPanel
              form={form}
              answers={answers}
              activeFieldName={highlightField ?? activeField}
              activeLabel={highlightField ? "updated" : "listening"}
              onFieldChange={handleManualChange}
            />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
            <p className="text-xs text-muted-foreground">
              You can edit any field manually, or just say &quot;submit&quot; when ready.
            </p>
            <div className="flex items-center gap-2">
              {/* Same discard behavior as the voice "never mind" path
                  (discard_entry) — nothing gets saved, so a pile of empty
                  drafts doesn't build up from sessions someone just
                  wanted to back out of. */}
              <Button
                variant="secondary"
                disabled={phase === "submitting"}
                onClick={handleCancel}
                className="rounded-full"
                title="Discard this entry without saving"
              >
                Cancel
              </Button>
              {/* Always visible (not just once something's answered) so it's
                  never hard to find — just not usable until there's
                  something worth saving. */}
              <Button
                variant="secondary"
                disabled={answeredCount === 0 || phase === "submitting"}
                onClick={handleSaveDraft}
                className="rounded-full"
                title="Save what's been answered so far and continue later"
              >
                <Save className="size-4" />
                Save Draft
              </Button>
              <Button
                disabled={phase !== "review"}
                onClick={handleSubmit}
                className="rounded-full bg-teal text-teal-foreground hover:bg-[#18464d]"
              >
                {phase === "submitting" ? (
                  "Submitting…"
                ) : (
                  <>
                    <CheckCheck className="size-4" />
                    Confirm &amp; Submit
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

