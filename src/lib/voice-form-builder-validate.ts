// Maps whatever the voice-driven form builder's agent heard for a field
// type onto the real FieldType union — mirrors voice-agent-validate.ts's
// job of standing in for the structured-output guarantees a plain LLM
// tool call doesn't give you. A misheard/paraphrased type ("dropdown",
// "checkboxes", "yes or no") should map to the closest real type rather
// than silently creating a broken question or crashing the form builder.

import type { FieldType } from "@/types";

const FIELD_TYPE_ALIASES: Record<string, FieldType> = {
  "short text": "short_text",
  text: "short_text",
  string: "short_text",
  "single line text": "short_text",
  "long text": "long_text",
  paragraph: "long_text",
  textarea: "long_text",
  "text area": "long_text",
  number: "number",
  numeric: "number",
  phone: "phone",
  "phone number": "phone",
  telephone: "phone",
  mobile: "phone",
  email: "email",
  "email address": "email",
  date: "date",
  "yes no": "yes_no",
  boolean: "yes_no",
  "true false": "yes_no",
  "single select": "single_select",
  "single choice": "single_select",
  dropdown: "single_select",
  choice: "single_select",
  "radio buttons": "single_select",
  "multi select": "multi_select",
  "multiple choice": "multi_select",
  checkboxes: "multi_select",
  "multiple select": "multi_select",
};

/** Human-readable list for both the tool description and any "that's not
 * a valid type" message read back to the user. */
export const FIELD_TYPE_HINT =
  "short text, long text, number, phone, email, date, yes/no, single select, or multi select";

export function normalizeFieldType(raw: string): FieldType | null {
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return FIELD_TYPE_ALIASES[key] ?? null;
}
