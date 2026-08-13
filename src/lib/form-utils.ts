import type { Entry, EntryAnswer, FormDefinition, FormQuestion, FormSection } from "@/types";

export function getCurrentVersion(form: FormDefinition) {
  return (
    form.versions.find((v) => v.version === form.currentVersion) ??
    form.versions[form.versions.length - 1]
  );
}

export function getSections(form: FormDefinition): FormSection[] {
  return getCurrentVersion(form).sections;
}

export function getAllQuestions(form: FormDefinition): FormQuestion[] {
  return getSections(form).flatMap((s) => s.questions);
}

export function findQuestion(
  form: FormDefinition,
  fieldName: string
): FormQuestion | undefined {
  return getAllQuestions(form).find((q) => q.fieldName === fieldName);
}

/** Resolves a spoken section reference — an ordinal ("the second
 * section", "section 3"), "last", or a fragment of its current title
 * ("the vehicle details section") — to a section. Same matching
 * convention as findSectionIndex in form-builder-draft-store.tsx (kept
 * as a separate copy since that one works on DraftSection, this one on
 * the read-only, already-published FormSection). Returns undefined if
 * nothing matches. Used by the form-filling agent's go_to_section tool. */
export function findSectionByVoice(
  form: FormDefinition,
  identifier: string
): FormSection | undefined {
  const sections = getSections(form);
  const needle = identifier.trim().toLowerCase();
  if (!needle) return undefined;

  if (/\blast\b/.test(needle)) return sections[sections.length - 1];

  const numMatch = needle.match(/\d+/);
  if (numMatch) {
    const n = parseInt(numMatch[0], 10);
    if (n >= 1 && n <= sections.length) return sections[n - 1];
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
    if (needle.includes(word) && n <= sections.length) return sections[n - 1];
  }

  return sections.find((s) => s.title.toLowerCase().includes(needle));
}

/** Short, title-cased label derived from a fieldName — used for compact contexts like table headers. */
export function shortLabel(fieldName: string): string {
  return fieldName
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatAnswerValue(
  form: FormDefinition,
  answer: EntryAnswer
): string {
  const q = findQuestion(form, answer.fieldName);
  const { value } = answer;
  if (value === null || value === undefined || value === "") return "—";
  if (q?.fieldType === "yes_no") return value ? "Yes" : "No";
  if (q?.fieldType === "single_select" && q.options) {
    return q.options.find((o) => o.value === value)?.label ?? String(value);
  }
  if (q?.fieldType === "date" && typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/** True once every required, currently-visible question has a real answer.
 * Drives the "no PDF for a not-fully-filled entry" rule — an in-progress
 * draft (or one where required fields were skipped) shouldn't be allowed to
 * generate a document that looks finished when it isn't. */
export function isEntryComplete(form: FormDefinition, entry: Pick<Entry, "answers">): boolean {
  const answerMap: Record<string, EntryAnswer["value"]> = {};
  for (const a of entry.answers) answerMap[a.fieldName] = a.value;

  return getAllQuestions(form).every((q) => {
    const visible =
      !q.conditional || answerMap[q.conditional.dependsOnFieldName] === q.conditional.equals;
    if (!visible || !q.required) return true;
    const value = answerMap[q.fieldName];
    return value !== undefined && value !== null && value !== "";
  });
}

export function getAnswerValue(
  answers: EntryAnswer[],
  fieldName: string
): string {
  const found = answers.find((a) => a.fieldName === fieldName);
  if (!found || found.value === null || found.value === undefined || found.value === "")
    return "—";
  if (typeof found.value === "boolean") return found.value ? "Yes" : "No";
  if (Array.isArray(found.value)) return found.value.join(", ");
  return String(found.value);
}

export interface EntryColumnDef {
  /** Matches a FormQuestion.fieldName for data columns, or one of the
   * fixed pseudo-columns ("id" / "createdAt" / "email" / "status" /
   * "actions") for the ones that aren't driven by form questions. */
  key: string;
  label: string;
  /** Always shown — the Columns drawer lists it disabled/checked rather
   * than letting it be hidden, since the row would be unidentifiable or
   * unactionable without it. */
  mandatory: boolean;
}

/** The full, ordered set of columns the entries table can show — drives
 * both the table itself and the Columns drawer's checkbox list, so the
 * two never drift out of sync. */
export function getEntryTableColumns(form: FormDefinition): EntryColumnDef[] {
  const [firstCol, ...restCols] = form.entryListColumns;
  const cols: EntryColumnDef[] = [{ key: "id", label: "Entry ID", mandatory: true }];
  if (firstCol) {
    cols.push({
      key: firstCol,
      label: findQuestion(form, firstCol)?.columnLabel ?? shortLabel(firstCol),
      mandatory: true,
    });
  }
  for (const col of restCols) {
    cols.push({
      key: col,
      label: findQuestion(form, col)?.columnLabel ?? shortLabel(col),
      mandatory: false,
    });
  }
  cols.push(
    { key: "createdAt", label: "Entry Date", mandatory: false },
    { key: "email", label: "Email", mandatory: false },
    { key: "status", label: "Status", mandatory: false },
    { key: "actions", label: "Actions", mandatory: true }
  );
  return cols;
}
