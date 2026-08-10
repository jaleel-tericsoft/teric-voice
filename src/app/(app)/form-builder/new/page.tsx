"use client";

import { Suspense, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import type { FieldType, FormDefinition, FormSection, FormStatus } from "@/types";

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "field";
}

let uidCounter = 0;
function uid(prefix: string) {
  uidCounter += 1;
  return `${prefix}_${Date.now()}_${uidCounter}`;
}

interface DraftQuestion {
  id: string;
  questionText: string;
  fieldType: FieldType;
  required: boolean;
  optionsText: string; // comma-separated, used for single/multi select
  /** Set only when this question came from an existing form being edited —
   * preserves its real fieldName instead of re-deriving one from the
   * current question text, which wouldn't necessarily match (a form's
   * fieldName isn't always just a slug of its question text) and would
   * silently orphan every existing entry's answer for that field, plus
   * break the Entry List Columns preselection below. */
  fieldName?: string;
}

interface DraftSection {
  id: string;
  title: string;
  questions: DraftQuestion[];
}

function newQuestion(): DraftQuestion {
  return { id: uid("q"), questionText: "", fieldType: "short_text", required: true, optionsText: "" };
}

function newSection(index: number): DraftSection {
  return { id: uid("s"), title: `Section ${index}`, questions: [newQuestion()] };
}

function needsOptions(type: FieldType) {
  return type === "single_select" || type === "multi_select";
}

/** Reverse of the draft->FormDefinition build below — turns an existing
 * form's latest version back into editable draft state. */
function sectionsFromForm(form: FormDefinition): DraftSection[] {
  const latest =
    form.versions.find((v) => v.version === form.currentVersion) ??
    form.versions[form.versions.length - 1];
  if (!latest || latest.sections.length === 0) return [newSection(1)];

  return latest.sections.map((s) => ({
    id: s.id,
    title: s.title,
    questions: s.questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      fieldType: q.fieldType,
      required: q.required,
      optionsText: q.options?.map((o) => o.label).join(", ") ?? "",
      fieldName: q.fieldName,
    })),
  }));
}

export default function NewFormPage() {
  return (
    <Suspense fallback={null}>
      <NewFormPageContent />
    </Suspense>
  );
}

function NewFormPageContent() {
  const router = useRouter();
  const { addForm, updateForm, forms, getFormByFormId } = useFormsStore();

  const searchParams = useSearchParams();
  const editFormId = searchParams.get("edit");
  const editingForm = editFormId ? getFormByFormId(editFormId) : undefined;
  const isEditing = Boolean(editingForm);

  const [name, setName] = useState(() => editingForm?.name ?? "");
  const [description, setDescription] = useState(() => editingForm?.description ?? "");
  const [status, setStatus] = useState<FormStatus>(() => editingForm?.status ?? "draft");
  const [sections, setSections] = useState<DraftSection[]>(() =>
    editingForm ? sectionsFromForm(editingForm) : [newSection(1)]
  );
  const [entryColumns, setEntryColumns] = useState<string[]>(
    () => editingForm?.entryListColumns ?? []
  );

  // fieldName is preserved from the original question when editing, and
  // only derived fresh from question text for genuinely new questions —
  // keeps the entry-list-column picker (and the final saved form) in sync
  // as the user edits question wording without renaming existing fields.
  const allFields = useMemo(() => {
    return sections.flatMap((s) =>
      s.questions
        .filter((q) => q.questionText.trim())
        .map((q) => ({ fieldName: q.fieldName ?? slugify(q.questionText), label: q.questionText }))
    );
  }, [sections]);

  const questionCount = sections.reduce((sum, s) => sum + s.questions.length, 0);
  const canCreate = name.trim().length > 0 && allFields.length > 0;

  function updateSection(id: string, patch: Partial<DraftSection>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function updateQuestion(sectionId: string, questionId: string, patch: Partial<DraftQuestion>) {
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

  function handleSave() {
    if (!canCreate) return;

    const builtSections: FormSection[] = sections
      .filter((s) => s.questions.some((q) => q.questionText.trim()))
      .map((s, si) => ({
        id: s.id,
        title: s.title.trim() || `Section ${si + 1}`,
        order: si + 1,
        questions: s.questions
          .filter((q) => q.questionText.trim())
          .map((q, qi) => ({
            id: q.id,
            order: qi + 1,
            fieldName: q.fieldName ?? slugify(q.questionText),
            questionText: q.questionText.trim(),
            fieldType: q.fieldType,
            required: q.required,
            options: needsOptions(q.fieldType)
              ? q.optionsText
                  .split(",")
                  .map((o) => o.trim())
                  .filter(Boolean)
                  .map((label) => ({ id: uid("opt"), label, value: slugify(label) }))
              : undefined,
          })),
      }));

    const now = new Date().toISOString();
    const columns = entryColumns.length > 0 ? entryColumns : allFields.slice(0, 4).map((f) => f.fieldName);

    if (editingForm) {
      // Keep the same id/formId (and version history) — editing a form
      // shouldn't change its URL or reset its entries. The questions just
      // become a new version, same convention as the seeded sample forms.
      const nextVersion = editingForm.currentVersion + 1;
      updateForm(editingForm.id, {
        name: name.trim(),
        description: description.trim(),
        status,
        updatedAt: now,
        entryListColumns: columns,
        currentVersion: nextVersion,
        versions: [
          ...editingForm.versions,
          { id: uid("fv"), version: nextVersion, publishedAt: now, sections: builtSections },
        ],
      });
      router.push("/form-builder");
      return;
    }

    let formIdSlug = slugify(name);
    if (forms.some((f) => f.formId === formIdSlug)) {
      formIdSlug = `${formIdSlug}_${Date.now().toString(36)}`;
    }

    const newForm: FormDefinition = {
      id: uid("form"),
      formId: formIdSlug,
      name: name.trim(),
      description: description.trim(),
      status,
      currentVersion: 1,
      totalEntries: 0,
      updatedAt: now,
      entryListColumns: columns,
      versions: [
        {
          id: uid("fv"),
          version: 1,
          publishedAt: now,
          sections: builtSections,
        },
      ],
    };

    addForm(newForm);
    router.push("/form-builder");
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
              : "Define what your voice assistant should ask, then publish it."}
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
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as FormStatus)}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Only Active forms can be voice-filled. Draft and Inactive both block new entries.
            </p>
          </div>
        </div>
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

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-5">
        <Button variant="ghost" asChild className="rounded-full">
          <Link href="/form-builder">Cancel</Link>
        </Button>
        <Button disabled={!canCreate} onClick={handleSave} className="rounded-full">
          {status === "draft" ? (
            <>
              <Save className="size-4" />
              Save as Draft
            </>
          ) : (
            <>
              <CheckCheck className="size-4" />
              {isEditing ? "Save & Publish" : "Publish Form"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
