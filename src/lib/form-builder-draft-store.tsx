"use client";

// Session-only, shared draft state for the form builder — mirrors
// forms-store.tsx/entries-store.tsx (no backend yet, doesn't survive a
// reload). Lifted out of form-builder/new/page.tsx into a context mounted
// at the (app) layout specifically so the ambient voice widget's
// form-builder tools can drive the exact same state the manual UI edits —
// one source of truth either way, not two copies that could drift apart.
//
// The page's own click-driven editing (per-section/per-question add/
// remove, drag handles, checkboxes) still lives in the page component
// itself, unchanged — it just reads/writes through this store's raw state
// setters (same shape as useState's) instead of local useState. Only the
// actions the voice tools need are modeled here as first-class store
// methods, since those are the ones a tool handler outside the page has
// to call.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useFormsStore } from "@/lib/forms-store";
import type { FieldType, FormDefinition, FormSection, FormStatus } from "@/types";

export interface DraftQuestion {
  id: string;
  questionText: string;
  fieldType: FieldType;
  required: boolean;
  optionsText: string; // comma-separated, used for single/multi select
  /** Set only when this question came from an existing form being edited —
   * preserves its real fieldName instead of re-deriving one from the
   * current question text (see sectionsFromForm below). */
  fieldName?: string;
}

export interface DraftSection {
  id: string;
  title: string;
  questions: DraftQuestion[];
}

let uidCounter = 0;
function uid(prefix: string) {
  uidCounter += 1;
  return `${prefix}_${Date.now()}_${uidCounter}`;
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field"
  );
}

export function newQuestion(): DraftQuestion {
  return { id: uid("q"), questionText: "", fieldType: "short_text", required: true, optionsText: "" };
}

export function newSection(index: number, title?: string): DraftSection {
  return { id: uid("s"), title: title?.trim() || `Section ${index}`, questions: [newQuestion()] };
}

export function needsOptions(type: FieldType): boolean {
  return type === "single_select" || type === "multi_select";
}

export function computeAllFields(sections: DraftSection[]): { fieldName: string; label: string }[] {
  return sections.flatMap((s) =>
    s.questions
      .filter((q) => q.questionText.trim())
      .map((q) => ({ fieldName: q.fieldName ?? slugify(q.questionText), label: q.questionText }))
  );
}

/** Reverse of the draft->FormDefinition build in save() below — turns an
 * existing form's latest version back into editable draft state. */
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

/** Resolves a spoken section reference — an ordinal ("the second
 * section", "section 3"), "last", or a fragment of its current title
 * ("the vehicle details section") — to an index. Returns -1 if nothing
 * matches. Shared by every voice action that targets a section. */
function findSectionIndex(sections: DraftSection[], identifier: string): number {
  const needle = identifier.trim().toLowerCase();
  if (!needle) return -1;

  if (/\blast\b/.test(needle)) return sections.length - 1;

  const numMatch = needle.match(/\d+/);
  if (numMatch) {
    const n = parseInt(numMatch[0], 10);
    if (n >= 1 && n <= sections.length) return n - 1;
  }

  const ordinals: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
  };
  for (const [word, n] of Object.entries(ordinals)) {
    if (needle.includes(word) && n <= sections.length) return n - 1;
  }

  return sections.findIndex((s) => s.title.toLowerCase().includes(needle));
}

/** Same idea as findSectionIndex, but for a question — searched across
 * every section by a fragment of its text, since a question doesn't have
 * a natural ordinal the way a section does. Returns the section+question
 * index pair, or null if nothing matches. */
function findQuestionLocation(
  sections: DraftSection[],
  identifier: string
): { sectionIndex: number; questionIndex: number } | null {
  const needle = identifier.trim().toLowerCase();
  if (!needle) return null;
  for (let si = 0; si < sections.length; si++) {
    const qi = sections[si].questions.findIndex((q) => q.questionText.toLowerCase().includes(needle));
    if (qi !== -1) return { sectionIndex: si, questionIndex: qi };
  }
  return null;
}

interface ActionResult {
  ok: boolean;
  message: string;
}

export type MoveDirection = "up" | "down";

interface FormBuilderDraftStore {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  status: FormStatus;
  setStatus: (v: FormStatus) => void;
  sections: DraftSection[];
  setSections: Dispatch<SetStateAction<DraftSection[]>>;
  entryColumns: string[];
  setEntryColumns: Dispatch<SetStateAction<string[]>>;
  isEditing: boolean;
  editingForm: FormDefinition | undefined;
  /** Idempotently (re)seeds the draft for whichever form/mode the page is
   * showing — "new" for a blank draft, or a form's id when editing. Only
   * actually resets state the first time a given key is seen, so
   * navigating away from /form-builder/new and back (including via a
   * voice command) doesn't wipe out a draft still being built. */
  ensureInitialized: (key: string, form: FormDefinition | undefined) => void;
  /** Builds and persists the form via forms-store. `statusOverride`, when
   * given, wins over the store's own `status` state — needed by the
   * voice save_form tool, which may set a status in the same breath it
   * saves, and can't rely on a setState call landing before this reads
   * it back. */
  save: (statusOverride?: FormStatus) => ActionResult;
  setFormNameByVoice: (name: string) => ActionResult;
  setDescriptionByVoice: (description: string) => ActionResult;
  /** Adds a question to the last section. Reuses that section's still-
   * blank default question (the one every new section starts with) if
   * it's there and untouched, rather than always appending a new one —
   * otherwise a section's starter question block just sits there empty
   * forever, uncounted and unsaved, while every voice-added question
   * piles up after it. */
  addQuestionByVoice: (input: {
    questionText: string;
    fieldType: FieldType;
    required: boolean;
    options: string[];
  }) => ActionResult;
  /** Removes the first question whose text contains the given text
   * (case-insensitive) — the target for remove_question. */
  removeQuestionByVoice: (questionText: string) => ActionResult;
  /** Changes one or more fields on an already-added question, identified
   * by a fragment of its current text — the target for update_question
   * ("change any field when asked"). */
  updateQuestionByVoice: (
    identifier: string,
    patch: {
      questionText?: string;
      fieldType?: FieldType;
      required?: boolean;
      options?: string[];
    }
  ) => ActionResult;
  /** Swaps a question with its neighbor in the given direction, within
   * its own section. */
  moveQuestionByVoice: (identifier: string, direction: MoveDirection) => ActionResult;
  addSectionByVoice: (title?: string) => ActionResult;
  setSectionTitleByVoice: (identifier: string, title: string) => ActionResult;
  /** Swaps a section with its neighbor in the given direction. */
  moveSectionByVoice: (identifier: string, direction: MoveDirection) => ActionResult;
  /** Adds or removes a field from the Entries table column picker,
   * matched by field name or its question label. */
  toggleEntryColumnByVoice: (fieldNameOrLabel: string) => ActionResult;
}

const FormBuilderDraftContext = createContext<FormBuilderDraftStore | null>(null);

export function FormBuilderDraftProvider({ children }: { children: ReactNode }) {
  const { forms, addForm, updateForm } = useFormsStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<FormStatus>("draft");
  const [sections, setSections] = useState<DraftSection[]>(() => [newSection(1)]);
  const [entryColumns, setEntryColumns] = useState<string[]>([]);
  const [editingForm, setEditingForm] = useState<FormDefinition | undefined>(undefined);
  const initializedKeyRef = useRef<string | null>(null);

  const ensureInitialized = useCallback((key: string, form: FormDefinition | undefined) => {
    if (initializedKeyRef.current === key) return;
    initializedKeyRef.current = key;
    setEditingForm(form);
    setName(form?.name ?? "");
    setDescription(form?.description ?? "");
    setStatus(form?.status ?? "draft");
    setSections(form ? sectionsFromForm(form) : [newSection(1)]);
    setEntryColumns(form?.entryListColumns ?? []);
  }, []);

  const save = useCallback(
    (statusOverride?: FormStatus): ActionResult => {
      const effectiveStatus = statusOverride ?? status;
      const allFields = computeAllFields(sections);
      if (!name.trim()) return { ok: false, message: "The form needs a name before it can be saved." };
      if (allFields.length === 0) {
        return { ok: false, message: "Add at least one question with some text before saving." };
      }

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
      const columns =
        entryColumns.length > 0 ? entryColumns : allFields.slice(0, 4).map((f) => f.fieldName);

      if (editingForm) {
        const nextVersion = editingForm.currentVersion + 1;
        updateForm(editingForm.id, {
          name: name.trim(),
          description: description.trim(),
          status: effectiveStatus,
          updatedAt: now,
          entryListColumns: columns,
          currentVersion: nextVersion,
          versions: [
            ...editingForm.versions,
            { id: uid("fv"), version: nextVersion, publishedAt: now, sections: builtSections },
          ],
        });
        return { ok: true, message: `Saved — "${name.trim()}" is now on version ${nextVersion}.` };
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
        status: effectiveStatus,
        currentVersion: 1,
        totalEntries: 0,
        updatedAt: now,
        entryListColumns: columns,
        versions: [{ id: uid("fv"), version: 1, publishedAt: now, sections: builtSections }],
      };
      addForm(newForm);
      const statusLabel =
        effectiveStatus === "active" ? "live" : effectiveStatus === "draft" ? "saved as a draft" : "saved as inactive";
      return { ok: true, message: `Saved — "${name.trim()}" is ${statusLabel}.` };
    },
    [addForm, description, editingForm, entryColumns, forms, name, sections, status, updateForm]
  );

  const setFormNameByVoice = useCallback((newName: string): ActionResult => {
    const trimmed = newName.trim();
    if (!trimmed) return { ok: false, message: "I need an actual name to set." };
    setName(trimmed);
    return { ok: true, message: `Form name set to "${trimmed}".` };
  }, []);

  const setDescriptionByVoice = useCallback((newDescription: string): ActionResult => {
    const trimmed = newDescription.trim();
    if (!trimmed) return { ok: false, message: "I need an actual description to set." };
    setDescription(trimmed);
    return { ok: true, message: "Description set." };
  }, []);

  const addQuestionByVoice = useCallback(
    ({
      questionText,
      fieldType,
      required,
      options,
    }: {
      questionText: string;
      fieldType: FieldType;
      required: boolean;
      options: string[];
    }): ActionResult => {
      const trimmed = questionText.trim();
      if (!trimmed) return { ok: false, message: "I need the actual question text to add it." };
      setSections((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        const lastSection = next[lastIdx];
        const question: DraftQuestion = {
          id: uid("q"),
          questionText: trimmed,
          fieldType,
          required,
          optionsText: options.join(", "),
        };
        // Reuse the section's still-blank starter question in place,
        // rather than leaving it stranded and piling this one on after —
        // see the store method's own doc comment above for why.
        const blankIdx = lastSection.questions.length - 1;
        const lastQuestionIsBlank =
          lastSection.questions.length > 0 && !lastSection.questions[blankIdx].questionText.trim();
        const questions = lastQuestionIsBlank
          ? lastSection.questions.map((q, i) => (i === blankIdx ? { ...question, id: q.id } : q))
          : [...lastSection.questions, question];
        next[lastIdx] = { ...lastSection, questions };
        return next;
      });
      return { ok: true, message: `Added "${trimmed}".` };
    },
    []
  );

  const removeQuestionByVoice = useCallback((questionText: string): ActionResult => {
    const needle = questionText.trim().toLowerCase();
    if (!needle) return { ok: false, message: "I need to know which question to remove." };

    let removed = false;
    let blockedSingleton = false;
    setSections((prev) =>
      prev.map((s) => {
        if (removed) return s;
        const idx = s.questions.findIndex((q) => q.questionText.toLowerCase().includes(needle));
        if (idx === -1) return s;
        if (s.questions.length <= 1) {
          blockedSingleton = true;
          return s;
        }
        removed = true;
        return { ...s, questions: s.questions.filter((_, i) => i !== idx) };
      })
    );

    if (removed) return { ok: true, message: "Removed." };
    if (blockedSingleton) {
      return {
        ok: false,
        message:
          "That's the only question in its section — add another question there first, or it'll have to stay.",
      };
    }
    return { ok: false, message: `Couldn't find a question matching "${questionText}".` };
  }, []);

  const updateQuestionByVoice = useCallback(
    (
      identifier: string,
      patch: { questionText?: string; fieldType?: FieldType; required?: boolean; options?: string[] }
    ): ActionResult => {
      let result: ActionResult | null = null;
      setSections((prev) => {
        const loc = findQuestionLocation(prev, identifier);
        if (!loc) {
          result = { ok: false, message: `Couldn't find a question matching "${identifier}".` };
          return prev;
        }
        const next = [...prev];
        const section = next[loc.sectionIndex];
        const question = section.questions[loc.questionIndex];
        const updated: DraftQuestion = {
          ...question,
          questionText: patch.questionText?.trim() || question.questionText,
          fieldType: patch.fieldType ?? question.fieldType,
          required: patch.required ?? question.required,
          optionsText: patch.options ? patch.options.join(", ") : question.optionsText,
        };
        next[loc.sectionIndex] = {
          ...section,
          questions: section.questions.map((q, i) => (i === loc.questionIndex ? updated : q)),
        };
        result = { ok: true, message: `Updated "${updated.questionText}".` };
        return next;
      });
      return result ?? { ok: false, message: "Nothing changed." };
    },
    []
  );

  const moveQuestionByVoice = useCallback((identifier: string, direction: MoveDirection): ActionResult => {
    let result: ActionResult | null = null;
    setSections((prev) => {
      const loc = findQuestionLocation(prev, identifier);
      if (!loc) {
        result = { ok: false, message: `Couldn't find a question matching "${identifier}".` };
        return prev;
      }
      const section = prev[loc.sectionIndex];
      const targetIdx = direction === "up" ? loc.questionIndex - 1 : loc.questionIndex + 1;
      if (targetIdx < 0 || targetIdx >= section.questions.length) {
        result = { ok: false, message: `That question is already at the ${direction === "up" ? "top" : "bottom"} of its section.` };
        return prev;
      }
      const questions = [...section.questions];
      [questions[loc.questionIndex], questions[targetIdx]] = [questions[targetIdx], questions[loc.questionIndex]];
      const next = [...prev];
      next[loc.sectionIndex] = { ...section, questions };
      result = { ok: true, message: `Moved ${direction}.` };
      return next;
    });
    return result ?? { ok: false, message: "Nothing changed." };
  }, []);

  const addSectionByVoice = useCallback((title?: string): ActionResult => {
    let sectionTitle = "";
    setSections((prev) => {
      const section = newSection(prev.length + 1, title);
      sectionTitle = section.title;
      return [...prev, section];
    });
    return { ok: true, message: `Added a new section${sectionTitle ? `, "${sectionTitle}"` : ""}.` };
  }, []);

  const setSectionTitleByVoice = useCallback((identifier: string, title: string): ActionResult => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return { ok: false, message: "I need an actual title to set." };
    let result: ActionResult | null = null;
    setSections((prev) => {
      const idx = findSectionIndex(prev, identifier);
      if (idx === -1) {
        result = { ok: false, message: `Couldn't find a section matching "${identifier}".` };
        return prev;
      }
      const next = [...prev];
      next[idx] = { ...next[idx], title: trimmedTitle };
      result = { ok: true, message: `Section renamed to "${trimmedTitle}".` };
      return next;
    });
    return result ?? { ok: false, message: "Nothing changed." };
  }, []);

  const moveSectionByVoice = useCallback((identifier: string, direction: MoveDirection): ActionResult => {
    let result: ActionResult | null = null;
    setSections((prev) => {
      const idx = findSectionIndex(prev, identifier);
      if (idx === -1) {
        result = { ok: false, message: `Couldn't find a section matching "${identifier}".` };
        return prev;
      }
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) {
        result = { ok: false, message: `That section is already at the ${direction === "up" ? "top" : "bottom"}.` };
        return prev;
      }
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      result = { ok: true, message: `Moved ${direction}.` };
      return next;
    });
    return result ?? { ok: false, message: "Nothing changed." };
  }, []);

  const toggleEntryColumnByVoice = useCallback(
    (fieldNameOrLabel: string): ActionResult => {
      const needle = fieldNameOrLabel.trim().toLowerCase();
      if (!needle) return { ok: false, message: "I need to know which field." };
      const allFields = computeAllFields(sections);
      const match =
        allFields.find((f) => f.fieldName.toLowerCase() === needle) ??
        allFields.find((f) => f.label.toLowerCase().includes(needle));
      if (!match) return { ok: false, message: `Couldn't find a field matching "${fieldNameOrLabel}".` };

      let nowIncluded = false;
      setEntryColumns((prev) => {
        if (prev.includes(match.fieldName)) {
          nowIncluded = false;
          return prev.filter((f) => f !== match.fieldName);
        }
        nowIncluded = true;
        return [...prev, match.fieldName];
      });
      return {
        ok: true,
        message: `"${match.label}" is ${nowIncluded ? "now" : "no longer"} shown as an Entries column.`,
      };
    },
    [sections]
  );

  const value = useMemo<FormBuilderDraftStore>(
    () => ({
      name,
      setName,
      description,
      setDescription,
      status,
      setStatus,
      sections,
      setSections,
      entryColumns,
      setEntryColumns,
      isEditing: Boolean(editingForm),
      editingForm,
      ensureInitialized,
      save,
      setFormNameByVoice,
      setDescriptionByVoice,
      addQuestionByVoice,
      removeQuestionByVoice,
      updateQuestionByVoice,
      moveQuestionByVoice,
      addSectionByVoice,
      setSectionTitleByVoice,
      moveSectionByVoice,
      toggleEntryColumnByVoice,
    }),
    [
      name,
      description,
      status,
      sections,
      entryColumns,
      editingForm,
      ensureInitialized,
      save,
      setFormNameByVoice,
      setDescriptionByVoice,
      addQuestionByVoice,
      removeQuestionByVoice,
      updateQuestionByVoice,
      moveQuestionByVoice,
      addSectionByVoice,
      setSectionTitleByVoice,
      moveSectionByVoice,
      toggleEntryColumnByVoice,
    ]
  );

  return (
    <FormBuilderDraftContext.Provider value={value}>{children}</FormBuilderDraftContext.Provider>
  );
}

export function useFormBuilderDraft(): FormBuilderDraftStore {
  const ctx = useContext(FormBuilderDraftContext);
  if (!ctx) throw new Error("useFormBuilderDraft must be used within <FormBuilderDraftProvider>");
  return ctx;
}
