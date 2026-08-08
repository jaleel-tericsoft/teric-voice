import type { FormQuestion } from "@/types";

export interface ScriptedAnswer {
  spoken: string;
  value: string | boolean;
  confidence: number;
  /** Optional clarification exchange to demo the confidence/clarification flow */
  clarify?: string;
}

// Curated, realistic answers for the V1 sample form so the voice demo feels real.
const employeeScript: Record<string, ScriptedAnswer> = {
  full_name: { spoken: "My name is Ahmed Khan.", value: "Ahmed Khan", confidence: 0.97 },
  date_of_birth: {
    spoken: "15th of August, 1995.",
    value: "1995-08-15",
    confidence: 0.93,
  },
  gender: { spoken: "Male.", value: "male", confidence: 0.95 },
  phone: { spoken: "9876543210", value: "9876543210", confidence: 0.95 },
  email: {
    spoken: "ahmed dot khan at example dot com",
    value: "ahmed@example.com",
    confidence: 0.9,
  },
  employment_status: {
    spoken: "I'm currently employed.",
    value: "employed",
    confidence: 0.68,
    clarify: "I understood your employment status as Employed. Is that correct?",
  },
  company_name: {
    spoken: "Nimbus Freight Private Limited.",
    value: "Nimbus Freight Pvt Ltd",
    confidence: 0.88,
  },
  years_experience: { spoken: "About four years.", value: "4", confidence: 0.91 },
  address: {
    spoken: "221B, Lake View Residency.",
    value: "221B, Lake View Residency",
    confidence: 0.86,
  },
  city: { spoken: "Bengaluru.", value: "Bengaluru", confidence: 0.95 },
  state: { spoken: "Karnataka.", value: "Karnataka", confidence: 0.96 },
  pin_code: { spoken: "560034", value: "560034", confidence: 0.94 },
  has_driving_license: {
    spoken: "Yes, I have one.",
    value: true,
    confidence: 0.98,
  },
  driving_license_number: {
    spoken: "D L, nine, zero, nine, eight.",
    value: "DL9098",
    confidence: 0.85,
  },
};

const genericByType: Record<string, ScriptedAnswer> = {
  short_text: { spoken: "That would be Ahmed Khan.", value: "Sample Value", confidence: 0.9 },
  long_text: { spoken: "Sure, let me spell that out.", value: "Sample description", confidence: 0.85 },
  number: { spoken: "Five.", value: "5", confidence: 0.9 },
  phone: { spoken: "9876543210", value: "9876543210", confidence: 0.93 },
  email: { spoken: "test at example dot com", value: "test@example.com", confidence: 0.88 },
  date: { spoken: "Today.", value: new Date().toISOString().slice(0, 10), confidence: 0.85 },
  yes_no: { spoken: "Yes.", value: true, confidence: 0.95 },
};

export function scriptedAnswerFor(
  question: FormQuestion,
  formSlug: string
): ScriptedAnswer {
  if (formSlug === "employee-information" && employeeScript[question.fieldName]) {
    return employeeScript[question.fieldName];
  }
  if (question.fieldType === "single_select" && question.options?.length) {
    const opt = question.options[0];
    return { spoken: opt.label, value: opt.value, confidence: 0.9 };
  }
  return (
    genericByType[question.fieldType] ?? {
      spoken: "Got it.",
      value: "—",
      confidence: 0.8,
    }
  );
}
