"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Mic,
  MicOff,
  Settings2,
  Sparkles,
  CheckCheck,
  AlertTriangle,
  Play,
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
import { getAllQuestions } from "@/lib/form-utils";
import {
  MicSession,
  speakText,
  transcribeAudio,
  interpretAnswer,
  SPEECH_LEVEL_THRESHOLD,
} from "@/lib/voice-client";
import { cn } from "@/lib/utils";
import type { FormDefinition, FormQuestion } from "@/types";

const MAX_RETRIES = 2; // repeat the question up to this many times if unanswered
const NEGATIVE_RE = /\b(no|nope|not correct|wrong|incorrect)\b/i;
const SUBMIT_INTENT_RE =
  /\b(submit|confirm(?:ed)?|that'?s (?:correct|right|it|all)|go ahead|looks good|yes,? submit)\b/i;

// Require slightly more deliberate speech to interrupt the assistant than
// to simply be picked up while listening — avoids stray noise cutting it off.
const BARGE_IN_THRESHOLD = SPEECH_LEVEL_THRESHOLD * 1.3;

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
] as const;
type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["value"];

function isPaused(pausedRef: { current: boolean }, cancelledRef: { current: boolean }) {
  return new Promise<void>((resolve) => {
    const check = () => {
      if (cancelledRef.current || !pausedRef.current) return resolve();
      setTimeout(check, 150);
    };
    check();
  });
}

/** Builds what the assistant should say for a question, including reading
 * out the options for a dropdown/single-select field. */
function questionPrompt(q: FormQuestion, attempt: number): string {
  let text = attempt === 0 ? q.questionText : `Sorry, I didn't catch that. ${q.questionText}`;
  if (q.fieldType === "single_select" && q.options?.length) {
    const labels = q.options.map((o) => o.label).join(", ");
    text += ` Your options are: ${labels}.`;
  }
  return text;
}

/** Chrome/Safari block audio.play() without a real click preceding it —
 * calling this from inside the "Start" button's onClick unlocks autoplay
 * for the rest of the tab, so later programmatic TTS playback isn't silently
 * blocked (which otherwise looks exactly like "it isn't reading anything"). */
function unlockAudioPlayback() {
  try {
    const a = new Audio();
    a.play().catch(() => {});
  } catch {
    // ignore — best-effort unlock
  }
}

export function VoiceExperience({ form }: { form: FormDefinition }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<"conversation" | "review" | "submitting">(
    "conversation"
  );
  const [orbState, setOrbState] = useState<OrbState>("speaking");
  const [assistantText, setAssistantText] = useState("");
  const [userText, setUserText] = useState("");
  const [activeField, setActiveField] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [paused, setPaused] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguageCode>("en");

  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Read from effects without re-running them whenever the user switches
  // language mid-session.
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // One mic permission grant, shared across the question loop AND the
  // review-phase "say submit" listener — kept alive between the two instead
  // of being re-acquired, and stopped only when the whole screen unmounts.
  const micRef = useRef<MicSession | null>(null);
  if (!micRef.current) micRef.current = new MicSession();
  useEffect(() => {
    return () => {
      micRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!started) return;

    const cancelledRef = { current: false };
    const mic = micRef.current!;

    function bargeInCheck() {
      return !pausedRef.current && mic.getLevel() > BARGE_IN_THRESHOLD;
    }

    async function speak(text: string): Promise<{ interrupted: boolean }> {
      setOrbState("speaking");
      setAssistantText(text);
      setUserText("");
      await isPaused(pausedRef, cancelledRef);
      if (cancelledRef.current) return { interrupted: false };
      // shouldInterrupt lets the user talk over the assistant instead of
      // waiting for it to finish — this is what makes it actually listen
      // mid-sentence rather than plowing through the whole question.
      return speakText(text, { shouldInterrupt: bargeInCheck });
    }

    async function listenAndTranscribe(): Promise<string> {
      setOrbState("listening");
      await isPaused(pausedRef, cancelledRef);
      if (cancelledRef.current) return "";
      const clip = await mic.recordUntilSilence();
      if (cancelledRef.current) return "";
      setOrbState("thinking");
      return transcribeAudio(clip, languageRef.current); // throws on failure
    }

    async function askQuestion(q: FormQuestion): Promise<string | boolean | null> {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (cancelledRef.current) return null;

        await speak(questionPrompt(q, attempt));
        if (cancelledRef.current) return null;

        const transcript = await listenAndTranscribe();
        if (cancelledRef.current) return null;

        if (!transcript.trim()) continue; // genuine silence — repeat the question

        setUserText(transcript);

        const interpretation = await interpretAnswer({
          question: q.questionText,
          fieldType: q.fieldType,
          options: q.options?.map((o) => o.value),
          transcript,
        });

        if (interpretation.off_topic) {
          // Didn't attempt to answer at all — redirect, don't burn a
          // confirmation round-trip on it.
          await speak(`Let's stay focused on the form. ${questionPrompt(q, 0)}`);
          continue;
        }

        if (!interpretation.needs_clarification) {
          return interpretation.value;
        }

        // Low-confidence / ambiguous — confirm before committing.
        await speak(interpretation.clarification_question ?? "Is that correct?");
        if (cancelledRef.current) return null;
        const confirmTranscript = await listenAndTranscribe();
        if (cancelledRef.current) return null;
        setUserText(confirmTranscript);

        if (confirmTranscript.trim() && !NEGATIVE_RE.test(confirmTranscript)) {
          return interpretation.value;
        }
        // treated as "no" (or unheard) — loop back and re-ask the question
      }
      return null; // gave up after MAX_RETRIES — leave unanswered, move on
    }

    async function run() {
      try {
        await mic.init();
      } catch {
        setMicError(
          "Microphone access was denied or unavailable. You can still fill out the form manually on the right."
        );
        setOrbState("idle");
        return;
      }

      const allQuestions = getAllQuestions(form);
      let local: AnswerMap = {};

      try {
        for (const q of allQuestions) {
          if (cancelledRef.current) break;
          if (
            q.conditional &&
            local[q.conditional.dependsOnFieldName] !== q.conditional.equals
          ) {
            continue;
          }

          setActiveField(q.fieldName);
          const value = await askQuestion(q);
          if (cancelledRef.current) break;

          if (value !== null) {
            local = { ...local, [q.fieldName]: value };
            setAnswers((prev) => ({ ...prev, [q.fieldName]: value }));
          }
        }
      } catch (err) {
        console.error("[voice] pipeline error", err);
        const reason = err instanceof Error ? err.message : String(err);
        setApiError(`${reason} — you can still fill out the form manually on the right.`);
        setOrbState("idle");
        mic.stop(); // hard failure — no more voice interaction this session
        return;
      }

      if (!cancelledRef.current) {
        setActiveField(null);
        setOrbState("idle");
        setAssistantText("All done — let's review your answers.");
        setUserText("");
        setPhase("review"); // mic stays live — the review-phase effect below reuses it
      }
    }

    run();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, form.id]);

  // Review phase: keep the mic responsive so the user can just say "submit"
  // instead of reaching for the button, per the voice-command flow in
  // scope.md ("Submit form", "Confirm", "Yes, submit").
  useEffect(() => {
    if (!started || phase !== "review" || micError || apiError) return;

    const cancelledRef = { current: false };
    const mic = micRef.current!;

    async function run() {
      try {
        await mic.init();
      } catch {
        return; // mic never worked — the Confirm & Submit button still works
      }
      if (cancelledRef.current) return;

      setOrbState("speaking");
      const prompt = "All done. Say submit when you're ready, or edit anything on the right first.";
      setAssistantText(prompt);
      setUserText("");
      await speakText(prompt, {
        shouldInterrupt: () => !pausedRef.current && mic.getLevel() > BARGE_IN_THRESHOLD,
      }).catch(() => {});
      if (cancelledRef.current) return;

      while (!cancelledRef.current) {
        setOrbState("listening");
        await isPaused(pausedRef, cancelledRef);
        if (cancelledRef.current) return;

        const clip = await mic.recordUntilSilence();
        if (cancelledRef.current) return;
        if (clip.size < 4000) continue; // essentially silence — keep waiting

        setOrbState("thinking");
        const transcript = await transcribeAudio(clip, languageRef.current).catch(() => "");
        if (cancelledRef.current) return;
        if (!transcript.trim()) continue;

        setUserText(transcript);

        if (SUBMIT_INTENT_RE.test(transcript)) {
          setOrbState("idle");
          handleSubmit();
          return;
        }
        setOrbState("idle");
      }
    }

    run();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, phase, micError, apiError]);

  // Manual-entry fallback: if voice never worked (mic denied, or the API
  // routes errored), let the user complete the form by hand and unlock
  // review once every required visible field is set.
  useEffect(() => {
    if ((!micError && !apiError) || phase !== "conversation") return;
    const allQuestions = getAllQuestions(form);
    const stillMissing = allQuestions.some((q) => {
      const visible =
        !q.conditional || answers[q.conditional.dependsOnFieldName] === q.conditional.equals;
      const answered = answers[q.fieldName] !== undefined && answers[q.fieldName] !== "";
      return visible && q.required && !answered;
    });
    if (!stillMissing) setPhase("review");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, micError, apiError, phase]);

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

  async function handleSubmit() {
    setPhase("submitting");
    await new Promise((r) => setTimeout(r, 1300));
    if (form.formId === "employee-information") {
      router.push("/entries/ENT-003");
    } else {
      router.push("/entries");
    }
  }

  const error = micError ?? apiError;

  const statusLabel =
    phase === "review"
      ? "Ready for review"
      : orbState === "speaking"
        ? "Speaking…"
        : orbState === "listening"
          ? "Listening…"
          : orbState === "thinking"
            ? "Thinking…"
            : "Idle";

  return (
    <div className="flex h-dvh w-full flex-col gap-3 bg-canvas p-3">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between rounded-2xl bg-background px-4">
        <button
          onClick={() => router.push("/entries")}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
          Exit
        </button>
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-lime" />
          <span className="font-semibold text-foreground">{form.name}</span>
          <span className="text-muted-foreground">· Voice Entry</span>
        </div>
        <div className="w-24 text-right text-xs text-muted-foreground">
          {answeredCount}/{visibleCount} answered
        </div>
      </div>

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

          {!started ? (
            /* Tap-to-begin gate — the click both starts the session and
               satisfies the browser's autoplay-needs-a-gesture requirement. */
            <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
              <span className="flex size-16 items-center justify-center rounded-full border border-white/20 bg-white/5">
                <Mic className="size-7 text-white/70" />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold">Ready when you are</h2>
                <p className="max-w-xs text-sm text-white/60">
                  Tap start, allow microphone access, and answer each question out loud. You
                  can talk over the assistant any time.
                </p>
              </div>
              <button
                onClick={() => {
                  unlockAudioPlayback();
                  setStarted(true);
                }}
                className="flex items-center gap-2 rounded-full bg-teal px-6 py-3 text-sm font-semibold text-teal-foreground transition-transform active:scale-[0.98]"
              >
                <Play className="size-4" />
                Start Voice Entry
              </button>
            </div>
          ) : (
            <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-8 py-10">
              {error ? (
                <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-warning/20 text-warning">
                    <AlertTriangle className="size-6" />
                  </span>
                  <p className="text-sm text-white/70">{error}</p>
                </div>
              ) : (
                <VoiceOrb state={phase === "submitting" ? "idle" : orbState} size={196} />
              )}

              <div className="flex max-w-md flex-col items-center gap-3 text-center">
                {!error && (
                  <p
                    key={assistantText}
                    className="animate-fade-in-up text-xl font-semibold leading-snug text-white"
                  >
                    {assistantText}
                  </p>
                )}
                {userText && !error && (
                  <p key={userText} className="animate-fade-in-up text-sm text-white/50">
                    “{userText}”
                  </p>
                )}
              </div>

              {!error && (
                <span className="text-xs font-medium uppercase tracking-wide text-white/40">
                  {paused ? "Paused" : statusLabel}
                </span>
              )}
            </div>
          )}

          {/* Control bar */}
          {started && !error && (
            <div className="relative flex items-center justify-center gap-3 pb-8">
              <button
                onClick={() => router.push("/entries")}
                className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                aria-label="End session"
              >
                <X className="size-[18px]" />
              </button>
              <button
                onClick={() => setPaused((p) => !p)}
                className={cn(
                  "flex size-14 items-center justify-center rounded-full transition-colors",
                  paused ? "bg-white/15 text-white" : "bg-teal text-teal-foreground"
                )}
                aria-label={paused ? "Resume microphone" : "Mute microphone"}
              >
                {paused ? <MicOff className="size-6" /> : <Mic className="size-6" />}
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
                      Set to English by default — switch if you'd rather answer in another
                      language.
                    </p>
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
              activeFieldName={phase === "conversation" ? activeField : null}
              onFieldChange={handleManualChange}
            />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
            <p className="text-xs text-muted-foreground">
              You can edit any field manually, or just say "submit" when ready.
            </p>
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
  );
}
