// Validates/normalizes what the ElevenLabs agent sends to record_answer.
// This is what stands in for the guarantees OpenAI's Zod structured output
// used to give us for free (a single_select value that's actually one of
// the real options, a real boolean, a real date) — an agent tool call is
// just whatever the model decided to send, so nothing here can be trusted
// without checking it first. On rejection, the returned `reason` is sent
// straight back to the agent as the tool's response, so it reads naturally
// as an instruction for what to tell the user and ask again.

import type { FormQuestion } from "@/types";

export type ValidationResult =
  | { ok: true; value: string | boolean }
  | { ok: false; reason: string };

const KM_TO_MILES = 0.621371;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Mirrors the old dateConstraintMessage — a "last serviced" date can't be
 * in the future, a "preferred" date can't be in the past. */
function dateConstraintReason(constraint: FormQuestion["dateConstraint"], isoDate: string): string | null {
  if (!constraint) return null;
  const date = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  if (constraint === "past" && date.getTime() > today.getTime()) {
    return "That date is in the future, but this needs to be a date that's already happened. Apologize briefly and ask for the date again.";
  }
  if (constraint === "future" && date.getTime() < today.getTime()) {
    return "That date has already passed, but this needs to be a date still ahead. Apologize briefly and ask for the date again.";
  }
  return null;
}

export function validateAnswer(q: FormQuestion, rawValue: string): ValidationResult {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { ok: false, reason: "That came through empty — ask the user to answer again." };
  }

  switch (q.fieldType) {
    case "yes_no": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "yes") return { ok: true, value: true };
      if (lower === "false" || lower === "no") return { ok: true, value: false };
      return {
        ok: false,
        reason: 'This is a yes/no question — send "true" or "false", not free text. Try again.',
      };
    }

    case "single_select": {
      const match = q.options?.find((o) => o.value === trimmed);
      if (match) return { ok: true, value: trimmed };
      const validValues = q.options?.map((o) => `"${o.value}"`).join(", ") ?? "(no options configured)";
      return {
        ok: false,
        reason: `"${trimmed}" is not one of the valid options for this field. Valid values are exactly: ${validValues}. Ask the user to clarify which one they mean, then send the exact value again — not the spoken label.`,
      };
    }

    case "multi_select": {
      const picked = trimmed
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const validValues = q.options?.map((o) => o.value) ?? [];
      const invalid = picked.filter((v) => !validValues.includes(v));
      if (invalid.length > 0 || picked.length === 0) {
        const validList = validValues.map((v) => `"${v}"`).join(", ") || "(no options configured)";
        return {
          ok: false,
          reason: `${invalid.length > 0 ? `"${invalid.join('", "')}" isn't/aren't a valid option` : "No valid options were sent"} for this field. Valid values are exactly: ${validList}. Ask the user to clarify which ones they mean, then send the exact comma-separated values again — not the spoken labels.`,
        };
      }
      // De-duped, in the field's own option order — so the recorded value
      // (and what gets read back to the user) is stable regardless of the
      // order the model happened to list them in.
      const ordered = validValues.filter((v) => picked.includes(v));
      return { ok: true, value: ordered.join(",") };
    }

    case "date": {
      if (!ISO_DATE_RE.test(trimmed) || Number.isNaN(new Date(trimmed).getTime())) {
        return {
          ok: false,
          reason: "That wasn't a valid date in YYYY-MM-DD format. Ask the user for the date again.",
        };
      }
      const constraintReason = dateConstraintReason(q.dateConstraint, trimmed);
      if (constraintReason) return { ok: false, reason: constraintReason };
      return { ok: true, value: trimmed };
    }

    case "number": {
      // "68000 km" -> convert deterministically rather than trusting the
      // model's own arithmetic (see the tool description for why the km
      // suffix convention exists).
      const kmMatch = trimmed.match(/^([\d.,]+)\s*km$/i);
      if (kmMatch) {
        const km = Number(kmMatch[1].replace(/,/g, ""));
        if (Number.isNaN(km)) {
          return { ok: false, reason: "Couldn't read that as a number — ask the user to state it again." };
        }
        return { ok: true, value: String(Math.round(km * KM_TO_MILES)) };
      }
      const num = Number(trimmed.replace(/,/g, "").replace(/[^0-9.]/g, ""));
      if (Number.isNaN(num) || trimmed.replace(/[^0-9.]/g, "") === "") {
        return {
          ok: false,
          reason: "That doesn't look like a number. Ask the user to state it again as a plain number.",
        };
      }
      return { ok: true, value: String(Math.round(num)) };
    }

    case "phone": {
      // UK mobile format: 11 digits starting "07" (e.g. 07700 900123),
      // or the +44 equivalent — strips everything but digits and a
      // leading "+" first, so spaced-out/punctuated numbers the model
      // already cleaned up still validate correctly either way.
      const digitsOnly = trimmed.replace(/[^\d+]/g, "");
      const ukMobileRe = /^(?:\+44|0)7\d{9}$/;
      if (!ukMobileRe.test(digitsOnly)) {
        return {
          ok: false,
          reason:
            "That doesn't look like a valid UK mobile number — it needs to be exactly 11 digits starting with 07 (e.g. 07700 900123), or the +44 equivalent. Read back what you heard, explain it doesn't look right, and ask the user to repeat or correct it.",
        };
      }
      // Normalized to the standard local 07xxx format regardless of
      // which form (with/without +44, with/without spaces) came in, so
      // every recorded number reads the same way in Entries/PDFs.
      const normalized = digitsOnly.startsWith("+44") ? `0${digitsOnly.slice(3)}` : digitsOnly;
      return { ok: true, value: normalized };
    }

    default:
      // short_text / long_text / email — no special validation, matches
      // the old behavior (these were never Zod-refined either).
      return { ok: true, value: trimmed };
  }
}

/** Whether the given field can be left unanswered — required fields can't
 * be skipped by voice command, same rule as the old isSkipCommand flow. */
export function canSkip(q: FormQuestion): { ok: true } | { ok: false; reason: string } {
  if (q.required) {
    return {
      ok: false,
      reason:
        "This field is required and can't be skipped. Apologize warmly, briefly explain it's required, and ask the question again.",
    };
  }
  return { ok: true };
}
