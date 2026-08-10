"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FormDefinition, FormQuestion } from "@/types";

export type AnswerMap = Record<string, string | boolean | undefined>;

function isVisible(question: FormQuestion, answers: AnswerMap) {
  if (!question.conditional) return true;
  const dep = answers[question.conditional.dependsOnFieldName];
  return dep === question.conditional.equals;
}

export function LiveFormPanel({
  form,
  answers,
  activeFieldName,
  activeLabel = "listening",
  onFieldChange,
}: {
  form: FormDefinition;
  answers: AnswerMap;
  activeFieldName: string | null;
  /** Label shown next to the highlighted field — "listening" while it's the
   * question currently being asked, or something like "updated" when the
   * highlight is flashing to show a just-applied correction instead. */
  activeLabel?: string;
  onFieldChange: (fieldName: string, value: string | boolean) => void;
}) {
  const version = form.versions.find((v) => v.version === form.currentVersion);

  return (
    <div className="flex flex-col gap-7">
      {version?.sections.map((section) => {
        const visibleQuestions = section.questions.filter((q) =>
          isVisible(q, answers)
        );
        if (visibleQuestions.length === 0) return null;
        return (
          <div key={section.id}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.title}
            </h3>
            <div className="flex flex-col gap-1">
              {visibleQuestions.map((q) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  value={answers[q.fieldName]}
                  active={activeFieldName === q.fieldName}
                  activeLabel={activeLabel}
                  onChange={(v) => onFieldChange(q.fieldName, v)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuestionRow({
  question,
  value,
  active,
  activeLabel,
  onChange,
}: {
  question: FormQuestion;
  value: string | boolean | undefined;
  active: boolean;
  activeLabel: string;
  onChange: (value: string | boolean) => void;
}) {
  const answered = value !== undefined && value !== "";
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [active]);

  return (
    <div
      ref={rowRef}
      className={cn(
        "animate-fade-in-up rounded-xl p-2.5 transition-colors",
        active && "bg-teal/8 ring-2 ring-teal/60"
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-xs font-medium text-foreground">
          {question.questionText}
          {question.required && <span className="text-destructive"> *</span>}
        </span>
        {active ? (
          <span className="flex items-center gap-1 text-[10px] font-medium text-teal">
            <span className="size-1.5 animate-pulse rounded-full bg-teal" />
            {activeLabel}
          </span>
        ) : answered ? (
          <CheckCircle2 className="size-3.5 text-success" />
        ) : (
          <Circle className="size-3 text-muted-foreground/30" />
        )}
      </div>
      <FieldControl question={question} value={value} onChange={onChange} />
    </div>
  );
}

function FieldControl({
  question,
  value,
  onChange,
}: {
  question: FormQuestion;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  const placeholder = "—";

  if (question.fieldType === "yes_no") {
    return (
      <div className="flex gap-2">
        {(["Yes", "No"] as const).map((opt) => {
          const boolVal = opt === "Yes";
          const selected = value === boolVal;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(boolVal)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                selected
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.fieldType === "single_select") {
    return (
      <Select
        value={typeof value === "string" ? value : undefined}
        onValueChange={(v) => onChange(v)}
      >
        <SelectTrigger className="h-9 w-full rounded-lg bg-background text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {question.options?.map((o) => (
            <SelectItem key={o.id} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (question.fieldType === "long_text") {
    return (
      <Textarea
        value={typeof value === "string" ? value : ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="rounded-lg bg-background text-sm"
      />
    );
  }

  return (
    <Input
      value={typeof value === "string" ? value : ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      type={question.fieldType === "date" ? "date" : "text"}
      className="h-9 rounded-lg bg-background text-sm"
    />
  );
}
