"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Mic, MicOff, Settings2, Sparkles, CheckCheck } from "lucide-react";
import { VoiceOrb, type OrbState } from "@/components/voice/voice-orb";
import { LiveFormPanel, type AnswerMap } from "@/components/voice/live-form-panel";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { getAllQuestions } from "@/lib/form-utils";
import { scriptedAnswerFor } from "@/lib/voice-script";
import { cn } from "@/lib/utils";
import type { FormDefinition } from "@/types";

function sleepFactory(cancelledRef: { current: boolean }, pausedRef: { current: boolean }) {
  return (ms: number) =>
    new Promise<void>((resolve) => {
      const tick = () => {
        if (cancelledRef.current) return resolve();
        if (pausedRef.current) {
          setTimeout(tick, 200);
          return;
        }
        setTimeout(resolve, ms);
      };
      tick();
    });
}

export function VoiceExperience({ form }: { form: FormDefinition }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"conversation" | "review" | "submitting">(
    "conversation"
  );
  const [orbState, setOrbState] = useState<OrbState>("speaking");
  const [assistantText, setAssistantText] = useState("Getting ready…");
  const [userText, setUserText] = useState("");
  const [activeField, setActiveField] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [paused, setPaused] = useState(false);

  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const cancelledRef = { current: false };
    const sleep = sleepFactory(cancelledRef, pausedRef);

    async function run() {
      const allQuestions = getAllQuestions(form);
      let local: AnswerMap = {};

      await sleep(600);

      for (const q of allQuestions) {
        if (cancelledRef.current) return;
        if (
          q.conditional &&
          local[q.conditional.dependsOnFieldName] !== q.conditional.equals
        ) {
          continue;
        }

        setActiveField(q.fieldName);
        setOrbState("speaking");
        setAssistantText(q.questionText);
        setUserText("");
        await sleep(1400);
        if (cancelledRef.current) return;

        setOrbState("listening");
        const scripted = scriptedAnswerFor(q, form.formId);
        await sleep(1200);
        if (cancelledRef.current) return;
        setUserText(scripted.spoken);
        await sleep(500);

        setOrbState("thinking");
        await sleep(550);
        if (cancelledRef.current) return;

        if (scripted.clarify) {
          setOrbState("speaking");
          setAssistantText(scripted.clarify);
          setUserText("");
          await sleep(1300);
          if (cancelledRef.current) return;
          setOrbState("listening");
          await sleep(900);
          setUserText("Yes, that's correct.");
          await sleep(600);
          setOrbState("thinking");
          await sleep(400);
          if (cancelledRef.current) return;
        }

        local = { ...local, [q.fieldName]: scripted.value };
        setAnswers((prev) => ({ ...prev, [q.fieldName]: scripted.value }));
        await sleep(550);
      }

      if (!cancelledRef.current) {
        setActiveField(null);
        setOrbState("idle");
        setAssistantText("All done — let's review your answers.");
        setUserText("");
        setPhase("review");
      }
    }

    run();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id]);

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

          <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-8 py-10">
            <VoiceOrb state={phase === "review" ? "idle" : orbState} size={196} />

            <div className="flex max-w-md flex-col items-center gap-3 text-center">
              <p
                key={assistantText}
                className="animate-fade-in-up text-xl font-semibold leading-snug text-white"
              >
                {assistantText}
              </p>
              {userText && (
                <p
                  key={userText}
                  className="animate-fade-in-up text-sm text-white/50"
                >
                  “{userText}”
                </p>
              )}
            </div>

            <span className="text-xs font-medium uppercase tracking-wide text-white/40">
              {paused ? "Paused" : statusLabel}
            </span>
          </div>

          {/* Control bar */}
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
            <button
              className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Settings"
            >
              <Settings2 className="size-[18px]" />
            </button>
          </div>
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
              You can edit any field manually before confirming.
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
