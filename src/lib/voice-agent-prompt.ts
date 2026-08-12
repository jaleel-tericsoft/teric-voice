// Builds the ElevenLabs Agent's per-session system prompt from a
// FormDefinition. The agent (one shared agent_id for the whole app) has no
// fixed script of its own — overrides.agent.prompt.prompt REPLACES its
// configured prompt entirely for that session, so this has to be complete
// and self-sufficient every time: general conversational rules AND the
// exact ordered question list, not just the form-specific part.
//
// This is what stands in for the old interpretAnswer/interpretReviewCommand
// OpenAI calls and the hand-written askQuestion() state machine — the
// agent's own model now does that reasoning live, guided by this prompt
// plus the four tool descriptions (record_answer, skip_field,
// save_draft_and_exit, submit_form) it always sees regardless of overrides.

import { getAllQuestions } from "@/lib/form-utils";
import type { AnswerMap } from "@/components/voice/live-form-panel";
import type { FormDefinition, FormQuestion } from "@/types";

function fieldTypeInstructions(q: FormQuestion): string {
  switch (q.fieldType) {
    case "yes_no":
      return 'Type: yes/no. Send the value to record_answer as exactly "true" or "false".';
    case "single_select": {
      const opts = (q.options ?? [])
        .map((o) => `"${o.value}" (say it aloud as "${o.label}")`)
        .join(", ");
      return `Type: single choice. The user must pick one of these — send record_answer the exact value in quotes below, never the spoken label: ${opts}.`;
    }
    case "date": {
      const constraint =
        q.dateConstraint === "past"
          ? " This date can never be in the future — if the user gives a future date, politely explain that and ask again."
          : q.dateConstraint === "future"
            ? " This date can never be in the past — if the user gives a date that's already gone, politely explain that and ask again."
            : "";
      return `Type: date. Send the value to record_answer as YYYY-MM-DD.${constraint}`;
    }
    case "phone":
      return "Type: phone number. Send the digits as the user said them, formatted naturally.";
    case "number":
      return "Type: number. Send just the number as digits, e.g. \"68000\" not \"sixty eight thousand\". If this question is about a distance/odometer reading and the user states it in kilometers, still send the raw number they said but append \" km\" right after it in the value (e.g. \"68000 km\") — do not convert it yourself, record_answer does that. If they say miles, or don't mention a unit, just send the plain number.";
    default:
      return "Type: free text. Send the cleaned-up text of what the user said.";
  }
}

/** Builds the full session prompt. `answers` (already-captured values, e.g.
 * from a resumed draft) are excluded from the question list entirely — the
 * agent should never re-ask something already on record. */
export function buildAgentPrompt(form: FormDefinition, answers: AnswerMap = {}): string {
  const questions = getAllQuestions(form).filter((q) => {
    const value = answers[q.fieldName];
    return value === undefined || value === "";
  });

  const questionBlocks = questions
    .map((q, i) => {
      const lines = [
        `${i + 1}. field_name: "${q.fieldName}"`,
        `   Ask: "${q.questionText}"`,
        `   ${fieldTypeInstructions(q)}`,
        `   ${q.required ? "Required — cannot be skipped." : "Optional — the user may ask to skip it."}`,
      ];
      if (q.helpText) lines.push(`   Context: ${q.helpText}`);
      if (q.voiceGuidance) lines.push(`   Voice guidance: ${q.voiceGuidance}`);
      if (q.conditional) {
        lines.push(
          `   Only ask this if field "${q.conditional.dependsOnFieldName}" was answered as "${q.conditional.equals}". Otherwise skip it silently — don't mention it at all.`
        );
      }
      return lines.join("\n");
    })
    .join("\n\n");

  return `You are a warm, polite, friendly voice assistant filling out the "${form.name}" form by asking the questions below, one at a time, and listening to the user's spoken answers.

GENERAL RULES:
- Ask only one question at a time, then wait for the answer. Never ask two questions in the same turn, never read the whole list out loud.
- Keep your own turns short and natural — this is a conversation, not a script being read. Never shout or sound robotic; keep the mood friendly throughout.
- Stay strictly on the form. If the user asks something unrelated or asks you a question back, answer briefly and helpfully if you genuinely know the answer from the context here, then return to the current question — never invent form data yourself.
- The moment the user gives a usable answer, call record_answer with that field's exact field_name and the value formatted per its type below. If it reports the value was rejected, apologize briefly, explain what was wrong in plain terms, and ask again — never guess a value yourself.
- The user can also ask to change an answer to any question you've ALREADY asked, not just the current one — if so, call record_answer with that earlier field's field_name and the new value, briefly confirm the change, then return to whichever question you were in the middle of.
- If the user asks you to repeat or re-read a question (current or already-asked), just say it again yourself from the list below, including its options if it's a choice question — no tool call needed for this.
- If the user explicitly asks to skip the current question, call skip_field. If it reports the field is required, explain that warmly and ask it again rather than moving on.
- If the user indicates at any point they need to stop and leave right now (an emergency, they're busy, anything urgent), call save_draft_and_exit immediately without asking anything else, then say one short reassuring sentence confirming it's saved as a draft, and stop.
- Once every question below has been asked (or skipped/left optional), read back a brief natural-language summary of the answers given so far and ask the user to confirm. Only call submit_form after they explicitly confirm it's correct — never call it mid-conversation.

QUESTIONS, IN ORDER:

${questionBlocks || "(Every question has already been answered — go straight to summarizing and asking the user to confirm submission.)"}`;
}

/** The agent's opening line for a session — mentions the very first
 * question so there's no dead air waiting for a generic greeting to finish
 * before anything useful happens. */
export function buildFirstMessage(form: FormDefinition, answers: AnswerMap = {}): string {
  const next = getAllQuestions(form).find((q) => {
    const value = answers[q.fieldName];
    if (value !== undefined && value !== "") return false;
    if (q.conditional && answers[q.conditional.dependsOnFieldName] !== q.conditional.equals) {
      return false;
    }
    return true;
  });
  if (!next) {
    return "Welcome back — looks like everything's already answered. Let's go over it together before you submit.";
  }
  const greeting = Object.keys(answers).length > 0 ? "Welcome back! Let's pick up where we left off." : "Hi there!";
  return `${greeting} ${next.questionText}`;
}
