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
import { getAllQuestions } from "@/lib/form-utils";
import {
  MicSession,
  speakText,
  transcribeAudio,
  interpretAnswer,
  interpretReviewCommand,
  getVoiceSensitivity,
  setVoiceSensitivity,
  getSensitivityConfig,
  createSustainedGate,
  type VoiceSensitivity,
} from "@/lib/voice-client";
import { useEntriesStore } from "@/lib/entries-store";
import { currentUser } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { Entry, EntryAnswer, FormDefinition, FormQuestion } from "@/types";

const MAX_RETRIES = 2; // repeat the question up to this many times if unanswered
const NEGATIVE_RE = /\b(no|nope|not correct|wrong|incorrect)\b/i;
const SUBMIT_INTENT_RE =
  /\b(submit|confirm(?:ed)?|that'?s (?:correct|right|it|all)|go ahead|looks good|yes,? submit)\b/i;
// Deliberately anchored to the whole (trimmed) utterance — "skip" needs to
// be the entire answer, not just a word that happens to appear inside a
// real one (e.g. an answer that legitimately contains "pass" or "next").
const SKIP_INTENT_RE =
  /^(skip(?: (?:it|this|that|question))?|next question|n\/a|not applicable)[.!]?$/i;

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

// Require slightly louder speech to interrupt the assistant than to simply
// be picked up while listening — avoids stray noise cutting it off.
const BARGE_IN_LEVEL_MULTIPLIER = 1.3;

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
] as const;
type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["value"];

const SENSITIVITY_OPTIONS: { value: VoiceSensitivity; label: string; hint: string }[] = [
  { value: "low", label: "Low", hint: "Best in noisy rooms — needs louder, clearer speech." },
  { value: "medium", label: "Medium", hint: "Balanced — the default for most spaces." },
  { value: "high", label: "High", hint: "Best in quiet rooms — picks up soft speech faster." },
];

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

type MessageLine = { text: string; kind: "sentence" | "option" };

/** Reformats one spoken assistant turn for display: one sentence per line
 * instead of a single dense paragraph, and a spoken "Your options are: A, B,
 * C." sentence expanded into its own labeled list — so a dropdown's choices
 * are actually scannable instead of buried in running text. Speech itself is
 * unaffected; this only changes what's rendered. */
function formatSpokenMessage(text: string): MessageLine[] {
  if (!text.trim()) return [];

  const sentences = text
    .split(/(?<=[.!?])\s+(?=["A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);

  const lines: MessageLine[] = [];
  for (const sentence of sentences) {
    const optionsMatch = sentence.match(/^Your options are:\s*(.+?)\.?$/i);
    if (optionsMatch) {
      lines.push({ text: "Your options are:", kind: "sentence" });
      optionsMatch[1]
        .replace(/,?\s+or\s+/i, ", ")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
        .forEach((opt) => lines.push({ text: opt, kind: "option" }));
    } else {
      lines.push({ text: sentence, kind: "sentence" });
    }
  }
  return lines;
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

export function VoiceExperience({
  form,
  resumeEntry,
}: {
  form: FormDefinition;
  /** When set, this is a previously saved draft/in-progress entry being
   * continued rather than a fresh one — its answers pre-fill the form and
   * the conversation skips straight to the first question still unanswered. */
  resumeEntry?: Entry;
}) {
  const router = useRouter();
  const { upsertEntry } = useEntriesStore();
  // Stable across the whole session (including any number of draft saves)
  // so re-saving or finally submitting always updates the same entry
  // instead of creating duplicates.
  const entryIdRef = useRef(resumeEntry?.id ?? generateEntryId());
  const createdAtRef = useRef(resumeEntry?.createdAt ?? new Date().toISOString());

  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<"conversation" | "review" | "submitting">(
    "conversation"
  );
  const [orbState, setOrbState] = useState<OrbState>("speaking");
  const [assistantText, setAssistantText] = useState("");
  const [userText, setUserText] = useState("");
  const [activeField, setActiveField] = useState<string | null>(null);
  // Briefly flashes a field in the form preview when a correction lands on
  // it — separate from `activeField` (the question currently being asked)
  // since a correction can target a totally different, already-visited
  // field and shouldn't permanently steal the highlight from where the
  // conversation actually is.
  const [highlightField, setHighlightField] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    if (!resumeEntry) return {};
    const map: AnswerMap = {};
    for (const a of resumeEntry.answers) {
      if (typeof a.value === "string" || typeof a.value === "boolean") map[a.fieldName] = a.value;
    }
    return map;
  });
  const [paused, setPaused] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [sensitivity, setSensitivity] = useState<VoiceSensitivity>(() => getVoiceSensitivity());

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

  // The review-phase loop below runs once and then keeps listening
  // indefinitely — it needs to see each field update as it happens, not the
  // stale snapshot captured when the effect first ran.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Clears a highlightField flash after a couple seconds — tracked so a
  // second correction landing before the first flash finishes resets the
  // timer instead of the two racing to clear each other early.
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashHighlight(fieldName: string) {
    setHighlightField(fieldName);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setHighlightField(null), 2200);
  }
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

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

  // Mirrors `sensitivity` for the listening loops below (which read a ref,
  // not state, since they run inside a long-lived effect) — updates
  // instantly if the user changes it mid-session from the control bar, and
  // persists so it's remembered next time too.
  const sensitivityRef = useRef(getSensitivityConfig(sensitivity));
  useEffect(() => {
    sensitivityRef.current = getSensitivityConfig(sensitivity);
    setVoiceSensitivity(sensitivity);
  }, [sensitivity]);

  useEffect(() => {
    if (!started) return;

    const cancelledRef = { current: false };
    const mic = micRef.current!;
    const sensitivity = sensitivityRef.current;
    const allQuestions = getAllQuestions(form);

    // Mutable, shared between askQuestion (reads it to spot corrections to
    // earlier fields) and run() (writes it as each question gets answered).
    // A ref rather than a `let` because askQuestion is defined before run()
    // but needs to see answers as they land, not a stale empty snapshot.
    // Seeded from `answers` so a resumed draft starts with what was already
    // captured last time, instead of asking everything all over again.
    const localRef: { current: AnswerMap } = { current: { ...answers } };

    // Every field the user has already been asked about, whether they
    // answered it, skipped it (ran out of retries), or it's the one being
    // asked right now — this is what makes a field a valid target for
    // "repeat that" / "change my answer to..." mid-conversation. Fields not
    // reached yet aren't referenceable (nothing to repeat or correct).
    const visitedFieldNamesRef: { current: Set<string> } = {
      current: new Set(Object.keys(answers)),
    };

    // Debounced: the raw level check must stay true continuously for
    // bargeInSustainMs before this reports true, so a single stray noise
    // frame while the assistant is talking doesn't cut it off.
    const bargeInCheck = createSustainedGate(
      () =>
        !pausedRef.current &&
        mic.getLevel(sensitivity.voiceBandMinRatio) >
          sensitivity.speechThreshold * BARGE_IN_LEVEL_MULTIPLIER,
      sensitivity.bargeInSustainMs
    );

    async function speak(text: string): Promise<{ interrupted: boolean }> {
      setOrbState("speaking");
      setAssistantText(text);
      setUserText("");
      await isPaused(pausedRef, cancelledRef);
      if (cancelledRef.current) return { interrupted: false };
      // Start capturing the mic now, before playback even begins — if the
      // user starts answering while the assistant is still mid-sentence
      // (very natural, people don't wait for a hard stop), those words land
      // in the same recording instead of being lost in the gap between
      // "assistant stops" and "we start listening", which used to force
      // people to repeat themselves.
      mic.startCapture({
        speechThreshold: sensitivity.speechThreshold,
        voiceBandMinRatio: sensitivity.voiceBandMinRatio,
        minSpeechMs: sensitivity.minSpeechMs,
      }).catch(() => {});
      // shouldInterrupt lets the user talk over the assistant instead of
      // waiting for it to finish — this is what makes it actually listen
      // mid-sentence rather than plowing through the whole question.
      return speakText(text, { shouldInterrupt: bargeInCheck });
    }

    async function listenAndTranscribe(): Promise<string> {
      setOrbState("listening");
      await isPaused(pausedRef, cancelledRef);
      if (cancelledRef.current) return "";
      // Continues the capture speak() already started (or starts one fresh,
      // if this is reached some other way) — doesn't discard whatever was
      // already recorded while the assistant was still talking.
      const clip = await mic.waitForCapture({
        speechThreshold: sensitivity.speechThreshold,
        voiceBandMinRatio: sensitivity.voiceBandMinRatio,
        minSpeechMs: sensitivity.minSpeechMs,
      });
      if (cancelledRef.current) return "";
      setOrbState("thinking");
      return transcribeAudio(clip, languageRef.current); // throws on failure
    }

    async function askQuestion(q: FormQuestion): Promise<string | boolean | null> {
      // Each attempt normally re-reads questionPrompt(q, attempt), which
      // prefixes retries with "Sorry, I didn't catch that" — appropriate
      // when nothing was heard. After a correction to an earlier answer,
      // though, the agent heard them just fine; this overrides the next
      // prompt with a natural "let's continue" instead of implying it
      // failed to listen.
      let overridePrompt: string | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (cancelledRef.current) return null;

        await speak(overridePrompt ?? questionPrompt(q, attempt));
        overridePrompt = null;
        if (cancelledRef.current) return null;

        const transcript = await listenAndTranscribe();
        if (cancelledRef.current) return null;

        if (!transcript.trim()) continue; // genuine silence — repeat the question

        setUserText(transcript);

        if (SKIP_INTENT_RE.test(transcript.trim())) {
          if (!q.required) {
            await speak("No problem, skipping that one.");
            return null; // leave unanswered, same as any other gap
          }
          // Required fields can't be skipped by voice — ask normally again
          // rather than silently failing or arguing with the user.
          overridePrompt = `That one's required, so I'll need an answer for it. ${questionPrompt(q, 0)}`;
          attempt--; // asking to skip isn't a failed attempt at answering
          continue;
        }

        const interpretation = await interpretAnswer({
          question: q.questionText,
          fieldType: q.fieldType,
          options: q.options?.map((o) => o.value),
          transcript,
        });

        if (interpretation.off_topic) {
          // Doesn't answer the current question — but before assuming the
          // user has wandered off-topic, check whether they're actually
          // referring to a question already visited (this one, an earlier
          // one they answered, or an earlier one that got skipped): either
          // correcting its value ("actually, change my email to...") or
          // asking to hear it again ("what were the options for employment
          // status again?"). Either way, handle it and pick back up on the
          // current question — don't make them wait for the review screen.
          const visitedFieldNames = visitedFieldNamesRef.current;
          if (visitedFieldNames.size > 0) {
            const referenceFields = allQuestions
              .filter((aq) => visitedFieldNames.has(aq.fieldName))
              .map((aq) => ({
                fieldName: aq.fieldName,
                label: aq.questionText,
                fieldType: aq.fieldType,
                options: aq.options?.map((o) => o.value),
                currentValue: localRef.current[aq.fieldName],
              }));
            const command = await interpretReviewCommand({ transcript, fields: referenceFields }).catch(
              () => null
            );

            if (
              command?.intent === "update_field" &&
              command.field_name &&
              visitedFieldNames.has(command.field_name)
            ) {
              const fieldName = command.field_name;
              localRef.current = { ...localRef.current, [fieldName]: command.value ?? "" };
              setAnswers((prev) => ({ ...prev, [fieldName]: command.value ?? "" }));
              flashHighlight(fieldName); // show exactly which field just changed
              // One natural line — confirm the change, then pick the
              // current question back up — rather than a robotic "sorry I
              // didn't catch that" retry.
              overridePrompt = `${command.spoken_reply || "Got it, updated."} Let's continue — ${questionPrompt(q, 0)}`;
              attempt--; // a correction isn't a failed attempt at this question — don't burn a retry on it
              continue;
            }

            if (
              command?.intent === "repeat_field" &&
              command.field_name &&
              visitedFieldNames.has(command.field_name)
            ) {
              const target = allQuestions.find((aq) => aq.fieldName === command.field_name);
              if (target && target.fieldName === q.fieldName) {
                // Repeating the very question in progress — just re-ask it,
                // including its options, and keep listening for its answer.
                overridePrompt = questionPrompt(q, 0);
                attempt--;
                continue;
              }
              if (target) {
                // A different, already-visited question (answered or
                // skipped) — read it back with its real options (not
                // whatever the model might recall) and give the user a
                // chance to answer it right now, then resume where we left
                // off. Move the highlight over to it while it's actually
                // being asked, since it's no longer the current question.
                setActiveField(target.fieldName);
                await speak(`Sure — ${questionPrompt(target, 0)}`);
                if (cancelledRef.current) return null;
                const targetTranscript = await listenAndTranscribe();
                if (cancelledRef.current) return null;

                if (targetTranscript.trim()) {
                  const targetInterpretation = await interpretAnswer({
                    question: target.questionText,
                    fieldType: target.fieldType,
                    options: target.options?.map((o) => o.value),
                    transcript: targetTranscript,
                  }).catch(() => null);
                  if (
                    targetInterpretation &&
                    !targetInterpretation.off_topic &&
                    !targetInterpretation.needs_clarification
                  ) {
                    localRef.current = {
                      ...localRef.current,
                      [target.fieldName]: targetInterpretation.value,
                    };
                    setAnswers((prev) => ({ ...prev, [target.fieldName]: targetInterpretation.value }));
                    flashHighlight(target.fieldName);
                  }
                }

                setActiveField(q.fieldName); // back to the question actually in progress
                overridePrompt = `Let's continue — ${questionPrompt(q, 0)}`;
                attempt--;
                continue;
              }
            }
          }

          // Genuinely off-topic — actually answer what they asked (or
          // respond to the small talk), then pick the form back up. A bare
          // "let's stay focused" dodge isn't a real answer and reads as
          // scripted rather than a natural assistant.
          const reply = interpretation.off_topic_reply?.trim();
          overridePrompt = reply
            ? `${reply} Now, back to the form — ${questionPrompt(q, 0)}`
            : questionPrompt(q, 0);
          attempt--; // answering a real question isn't a failed attempt at this one
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

      try {
        for (const q of allQuestions) {
          if (cancelledRef.current) break;
          if (
            q.conditional &&
            localRef.current[q.conditional.dependsOnFieldName] !== q.conditional.equals
          ) {
            continue;
          }
          // Already answered — either earlier this session, or carried over
          // from a resumed draft. Don't ask it again; this is what makes
          // "continue where I left off" actually skip straight to the first
          // genuinely unanswered field instead of starting over.
          const existing = localRef.current[q.fieldName];
          if (existing !== undefined && existing !== "") {
            visitedFieldNamesRef.current.add(q.fieldName);
            continue;
          }

          setActiveField(q.fieldName);
          visitedFieldNamesRef.current.add(q.fieldName); // referenceable for "repeat"/"change" from here on, even if it ends up skipped
          const value = await askQuestion(q);
          if (cancelledRef.current) break;

          if (value !== null) {
            localRef.current = { ...localRef.current, [q.fieldName]: value };
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

  // Review phase: keep the mic responsive for both "submit" AND corrections
  // ("change my phone number to...") — per scope.md's voice-command flow,
  // and so a change request gets a real answer instead of being silently
  // dropped for not matching a submit phrase.
  useEffect(() => {
    if (!started || phase !== "review" || micError || apiError) return;

    const cancelledRef = { current: false };
    const mic = micRef.current!;
    const reviewQuestions = getAllQuestions(form);
    const sensitivity = sensitivityRef.current;

    const bargeInCheck = createSustainedGate(
      () =>
        !pausedRef.current &&
        mic.getLevel(sensitivity.voiceBandMinRatio) >
          sensitivity.speechThreshold * BARGE_IN_LEVEL_MULTIPLIER,
      sensitivity.bargeInSustainMs
    );

    async function speak(text: string) {
      setOrbState("speaking");
      setAssistantText(text);
      setUserText("");
      await isPaused(pausedRef, cancelledRef);
      if (cancelledRef.current) return;
      // Same overlap trick as the conversation phase — start capturing
      // before playback begins so an early "actually, change..." doesn't
      // lose its first words.
      mic.startCapture({
        speechThreshold: sensitivity.speechThreshold,
        voiceBandMinRatio: sensitivity.voiceBandMinRatio,
        minSpeechMs: sensitivity.minSpeechMs,
      }).catch(() => {});
      await speakText(text, { shouldInterrupt: bargeInCheck }).catch(() => {});
    }

    async function run() {
      try {
        await mic.init();
      } catch {
        return; // mic never worked — the Confirm & Submit button still works
      }
      if (cancelledRef.current) return;

      await speak("All done. Say submit when you're ready, or ask to change any field.");
      if (cancelledRef.current) return;

      while (!cancelledRef.current) {
        setOrbState("listening");
        await isPaused(pausedRef, cancelledRef);
        if (cancelledRef.current) return;

        const clip = await mic.waitForCapture({
          speechThreshold: sensitivity.speechThreshold,
          voiceBandMinRatio: sensitivity.voiceBandMinRatio,
          minSpeechMs: sensitivity.minSpeechMs,
        });
        if (cancelledRef.current) return;
        if (clip.size < 4000) continue; // essentially silence — keep waiting

        setOrbState("thinking");
        const transcript = await transcribeAudio(clip, languageRef.current).catch(() => "");
        if (cancelledRef.current) return;
        if (!transcript.trim()) continue;

        setUserText(transcript);

        const fields = reviewQuestions.map((q) => ({
          fieldName: q.fieldName,
          label: q.questionText,
          fieldType: q.fieldType,
          options: q.options?.map((o) => o.value),
          currentValue: answersRef.current[q.fieldName],
        }));

        const command = await interpretReviewCommand({ transcript, fields }).catch(() => null);

        if (!command) {
          // Review-command API hiccup — fall back to a plain submit check
          // rather than leaving the user's request completely unanswered.
          if (SUBMIT_INTENT_RE.test(transcript)) {
            setOrbState("idle");
            handleSubmit();
            return;
          }
          continue;
        }

        if (command.intent === "submit") {
          await speak(command.spoken_reply);
          if (cancelledRef.current) return;
          handleSubmit();
          return;
        }

        if (
          command.intent === "update_field" &&
          command.field_name &&
          reviewQuestions.some((q) => q.fieldName === command.field_name)
        ) {
          setAnswers((prev) => ({ ...prev, [command.field_name as string]: command.value ?? "" }));
          flashHighlight(command.field_name); // show exactly which field just changed
        }

        if (command.intent === "repeat_field" && command.field_name) {
          // Re-read the question with its real options, whether it was
          // answered or skipped — don't trust the model to restate options
          // from memory when we have the authoritative list right here.
          const target = reviewQuestions.find((q) => q.fieldName === command.field_name);
          if (target) {
            await speak(questionPrompt(target, 0));
            if (cancelledRef.current) return;
            continue;
          }
        }

        // update_field confirmation or unclear guidance — either way, respond.
        await speak(command.spoken_reply);
        if (cancelledRef.current) return;
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

  /** Persists whatever's been answered so far as an in-progress entry and
   * exits — the entry shows up in Entries with a "Resume" action that
   * reopens this exact session and picks up on the first unanswered field. */
  function handleSaveDraft() {
    const entry = buildEntry({
      id: entryIdRef.current,
      form,
      answers,
      status: "in_progress",
      createdAt: createdAtRef.current,
      previous: resumeEntry,
    });
    upsertEntry(entry);
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
                  <div key={assistantText} className="animate-fade-in-up flex flex-col items-center gap-1.5">
                    {formatSpokenMessage(assistantText).map((line, i) =>
                      line.kind === "option" ? (
                        <span
                          key={i}
                          className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/85"
                        >
                          {line.text}
                        </span>
                      ) : (
                        <p key={i} className="text-lg leading-snug font-semibold text-white">
                          {line.text}
                        </p>
                      )
                    )}
                  </div>
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
                aria-label="End session without saving"
                title="Exit without saving"
              >
                <X className="size-[18px]" />
              </button>
              {answeredCount > 0 && (
                <button
                  onClick={handleSaveDraft}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20"
                  aria-label="Save as draft and exit"
                  title="Save what's been answered so far and continue later"
                >
                  <Save className="size-[15px]" />
                  Save Draft
                </button>
              )}
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
                        Set to English by default — switch if you'd rather answer in another
                        language.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Microphone sensitivity
                      </span>
                      <Select
                        value={sensitivity}
                        onValueChange={(v) => setSensitivity(v as VoiceSensitivity)}
                      >
                        <SelectTrigger className="h-9 w-full rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SENSITIVITY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        {SENSITIVITY_OPTIONS.find((o) => o.value === sensitivity)?.hint}
                        {" "}Skipping questions in a noisy room? Try Low.
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
              activeFieldName={highlightField ?? (phase === "conversation" ? activeField : null)}
              activeLabel={highlightField ? "updated" : "listening"}
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
