import type { Entry, EntryAnswer, FormDefinition, FormQuestion } from "@/types";

export function getCurrentVersion(form: FormDefinition) {
  return (
    form.versions.find((v) => v.version === form.currentVersion) ??
    form.versions[form.versions.length - 1]
  );
}

export function getAllQuestions(form: FormDefinition): FormQuestion[] {
  const version = getCurrentVersion(form);
  return version.sections.flatMap((s) => s.questions);
}

export function findQuestion(
  form: FormDefinition,
  fieldName: string
): FormQuestion | undefined {
  return getAllQuestions(form).find((q) => q.fieldName === fieldName);
}

export function fieldLabel(form: FormDefinition, fieldName: string): string {
  const q = findQuestion(form, fieldName);
  if (q) return q.questionText.replace(/\?$/, "");
  return shortLabel(fieldName);
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
      return d.toLocaleDateString("en-IN", {
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
