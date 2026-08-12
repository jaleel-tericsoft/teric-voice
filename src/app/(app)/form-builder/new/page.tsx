"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, GripVertical, CheckCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormsStore } from "@/lib/forms-store";
import {
  useFormBuilderDraft,
  computeAllFields,
  needsOptions,
  newQuestion,
  newSection,
  slugify,
  type DraftSection,
} from "@/lib/form-builder-draft-store";
import { cn } from "@/lib/utils";
import type { FieldType, FormStatus } from "@/types";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "short_text", label: "Short Text" },
  { value: "long_text", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "date", label: "Date" },
  { value: "yes_no", label: "Yes/No" },
  { value: "single_select", label: "Single Select" },
  { value: "multi_select", label: "Multi Select" },
];

export default function NewFormPage() {
  return (
    <Suspense fallback={null}>
      <NewFormPageContent />
    </Suspense>
  );
}

function NewFormPageContent() {
  const router = useRouter();
  const { getFormByFormId } = useFormsStore();

  const searchParams = useSearchParams();
  const editFormId = searchParams.get("edit");
  const editingFormLookup = editFormId ? getFormByFormId(editFormId) : undefined;

  const {
    name,
    setName,
    description,
    setDescription,
    sections,
    setSections,
    entryColumns,
    setEntryColumns,
    isEditing,
    editingForm,
    ensureInitialized,
    save,
  } = useFormBuilderDraft();

  // Seeds the shared draft the first time this page sees a given target
  // (a specific form to edit, or a blank "new") — see ensureInitialized's
  // own comment for why this doesn't just run on every render/mount.
  useEffect(() => {
    ensureInitialized(editFormId ?? "new", editingFormLookup);
  }, [editFormId, editingFormLookup, ensureInitialized]);

  // fieldName is preserved from the original question when editing, and
  // only derived fresh from question text for genuinely new questions —
  // keeps the entry-list-column picker (and the final saved form) in sync
  // as the user edits question wording without renaming existing fields.
  const allFields = useMemo(() => computeAllFields(sections), [sections]);

  const questionCount = sections.reduce((sum, s) => sum + s.questions.length, 0);
  const canCreate = name.trim().length > 0 && allFields.length > 0;

  function updateSection(id: string, patch: Partial<DraftSection>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function updateQuestion(sectionId: string, questionId: string, patch: Partial<DraftSection["questions"][number]>) {
    setSections((prev) =>
      prev.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              questions: s.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)),
            }
      )
    );
  }

  function addSection() {
    setSections((prev) => [...prev, newSection(prev.length + 1)]);
  }

  function removeSection(id: string) {
    setSections((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  }

  function addQuestion(sectionId: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, questions: [...s.questions, newQuestion()] } : s))
    );
  }

  function removeQuestion(sectionId: string, questionId: string) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId && s.questions.length > 1
          ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) }
          : s
      )
    );
  }

  function toggleColumn(fieldName: string) {
    setEntryColumns((prev) =>
      prev.includes(fieldName) ? prev.filter((f) => f !== fieldName) : [...prev, fieldName]
    );
  }

  function handleSave(statusOverride?: FormStatus) {
    if (!canCreate) return;
    const result = save(statusOverride);
    if (result.ok) router.push("/form-builder");
  }

  return (
    <div className="flex flex-col gap-5 pt-6 pb-10">
      <div className="flex items-center gap-3">
        <Link
          href="/form-builder"
          className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {isEditing ? `Edit ${editingForm!.name}` : "Create Form"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEditing
              ? "Changes save as a new version of this form."
              : "Define what your voice assistant should ask, then publish it. Say \"take me to the form builder\" any time to build one hands-free."}
          </p>
        </div>
      </div>

      {/* Basics */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-foreground">Basics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">Form Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Feedback Form"
              className="rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this form used for?"
              rows={2}
              className="rounded-xl"
            />
          </div>
        </div>
        {isEditing && (
          <p className="mt-4 text-[11px] text-muted-foreground">
            Active/inactive is set from the form&apos;s card in Form Builder, not here — only
            Active forms can be voice-filled.
          </p>
        )}
      </div>

      {/* Sections & Questions */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">
            Sections &amp; Questions
          </h2>
          <span className="text-xs text-muted-foreground">{questionCount} questions</span>
        </div>

        {sections.map((section, si) => (
          <div key={section.id} className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <GripVertical className="size-4 text-muted-foreground/40" />
              <Input
                value={section.title}
                onChange={(e) => updateSection(section.id, { title: e.target.value })}
                className="h-8 max-w-xs rounded-lg font-semibold"
                placeholder={`Section ${si + 1}`}
              />
              {sections.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto rounded-full text-muted-foreground"
                  onClick={() => removeSection(section.id)}
                  aria-label="Remove section"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {section.questions.map((q) => (
                <div
                  key={q.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-3.5"
                >
                  <div className="flex items-start gap-2">
                    <Input
                      value={q.questionText}
                      onChange={(e) =>
                        updateQuestion(section.id, q.id, { questionText: e.target.value })
                      }
                      placeholder="Question text, e.g. What is your full name?"
                      className="h-9 flex-1 rounded-lg"
                    />
                    {section.questions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 rounded-full text-muted-foreground"
                        onClick={() => removeQuestion(section.id, q.id)}
                        aria-label="Remove question"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Select
                      value={q.fieldType}
                      onValueChange={(v) =>
                        updateQuestion(section.id, q.id, { fieldType: v as FieldType })
                      }
                    >
                      <SelectTrigger className="h-8 w-40 rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((ft) => (
                          <SelectItem key={ft.value} value={ft.value}>
                            {ft.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch
                        checked={q.required}
                        onCheckedChange={(v) => updateQuestion(section.id, q.id, { required: v })}
                        size="sm"
                      />
                      Required
                    </label>

                    {q.questionText.trim() && (
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
                        {q.fieldName ?? slugify(q.questionText)}
                      </span>
                    )}
                  </div>

                  {needsOptions(q.fieldType) && (
                    <Input
                      value={q.optionsText}
                      onChange={(e) =>
                        updateQuestion(section.id, q.id, { optionsText: e.target.value })
                      }
                      placeholder="Options, comma separated e.g. Employed, Self-employed, Student"
                      className="h-8 rounded-lg text-xs"
                    />
                  )}
                </div>
              ))}

              <Button
                variant="ghost"
                size="sm"
                className="w-fit rounded-full text-xs text-muted-foreground"
                onClick={() => addQuestion(section.id)}
              >
                <Plus className="size-3.5" />
                Add Question
              </Button>
            </div>
          </div>
        ))}

        <Button
          variant="secondary"
          className="w-fit rounded-full text-xs"
          onClick={addSection}
        >
          <Plus className="size-3.5" />
          Add Section
        </Button>
      </div>

      {/* Entry list columns */}
      {allFields.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="mb-1 text-[15px] font-semibold text-foreground">
            Entry List Columns
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Choose which fields show as columns in the Entries table. Defaults to the first 4
            fields if none are picked.
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {allFields.map((f) => (
              <label
                key={f.fieldName}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs transition-colors",
                  entryColumns.includes(f.fieldName)
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Checkbox
                  checked={entryColumns.includes(f.fieldName)}
                  onCheckedChange={() => toggleColumn(f.fieldName)}
                />
                <span className="truncate">{f.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Footer actions — editing an existing form keeps its current
       * active/inactive/draft status untouched (that's a card-level
       * concern now); a genuinely new form needs an explicit choice since
       * it doesn't have a status yet. */}
      <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-5">
        <Button variant="ghost" asChild className="rounded-full">
          <Link href="/form-builder">Cancel</Link>
        </Button>
        {isEditing ? (
          <Button disabled={!canCreate} onClick={() => handleSave()} className="rounded-full">
            <Save className="size-4" />
            Save Changes
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={!canCreate}
              onClick={() => handleSave("draft")}
              className="rounded-full"
            >
              <Save className="size-4" />
              Save as Draft
            </Button>
            <Button disabled={!canCreate} onClick={() => handleSave("active")} className="rounded-full">
              <CheckCheck className="size-4" />
              Publish Form
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
