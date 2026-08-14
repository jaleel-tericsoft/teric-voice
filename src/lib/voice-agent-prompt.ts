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
// plus the tool descriptions (record_answer, skip_field,
// save_draft_and_exit, discard_entry, submit_form, announce_question,
// go_to_section, switch_voice, go_silent, resume_speaking, logout) it
// always sees regardless of overrides.

import { getAllQuestions } from "@/lib/form-utils";
import { timeOfDayGreeting } from "@/lib/voice-session-opening";
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
      return `Type: single choice — the user picks exactly ONE. Send record_answer the exact value in quotes below, never the spoken label: ${opts}.`;
    }
    case "multi_select": {
      const opts = (q.options ?? [])
        .map((o) => `"${o.value}" (say it aloud as "${o.label}")`)
        .join(", ");
      return `Type: multiple choice — the user may pick more than one. Send record_answer a single comma-separated value string listing every exact value they chose (e.g. "value_a,value_b"), never the spoken labels. Valid values: ${opts}. If they only pick one, send just that one value with no comma.`;
    }
    case "date": {
      const constraint =
        q.dateConstraint === "past"
          ? " This date can never be in the future — if the user gives a future date, politely explain that and ask again."
          : q.dateConstraint === "future"
            ? " This date can never be in the past — if the user gives a date that's already gone, politely explain that and ask again."
            : "";
      return `Type: date. Send the value to record_answer as YYYY-MM-DD. The user may answer with a relative phrase ("two days ago", "last Monday", "next Friday") instead of a calendar date — work out the actual date yourself from today's date (given below), state the date you worked out back to them for confirmation before calling record_answer (e.g. "So that would be the 10th of August — is that right?"), and only proceed once they confirm.${constraint}`;
    }
    case "phone":
      return 'Type: UK mobile number. Send it to record_answer as a plain string of digits, with or without a leading 0 or +44 (e.g. "07700900123" or "+447700900123") — it must be a real UK mobile number, 11 digits starting 07. record_answer checks this and will tell you plainly if a digit is missing, extra, or the format is wrong; if so, read back what you heard, explain it doesn\'t look right, and ask the user to repeat or correct it — never guess or round it off yourself.';
    case "number":
      return "Type: number. Send just the number as digits, e.g. \"68000\" not \"sixty eight thousand\". If this question is about a distance/odometer reading and the user states it in kilometers, still send the raw number they said but append \" km\" right after it in the value (e.g. \"68000 km\") — do not convert it yourself, record_answer does that; it converts to miles and tells you the converted figure in its response — state that converted miles figure back to the user (e.g. \"Got it, that's 42253 miles.\") rather than repeating the kilometers figure they gave you. If they say miles, or don't mention a unit, just send the plain number.";
    default:
      return "Type: free text. Send the cleaned-up text of what the user said.";
  }
}

/** Builds the full session prompt. `answers` (already-captured values, e.g.
 * from a resumed draft) are excluded from the question list entirely — the
 * agent should never re-ask something already on record. `assistantName`
 * is whichever persona (Ava/Leo) is currently speaking — named in the
 * prompt too, not just the opening line, so the agent answers consistently
 * if asked "what's your name?" mid-conversation. */
export function buildAgentPrompt(
  form: FormDefinition,
  answers: AnswerMap = {},
  assistantName = "Ava"
): string {
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

  const today = new Date();
  const todayLabel = today.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const todayIso = today.toISOString().slice(0, 10);

  return `You are ${assistantName}, a warm, polite, friendly voice assistant filling out the "${form.name}" form by asking the questions below, one at a time, and listening to the user's spoken answers.

Today's date is ${todayLabel} (${todayIso}) — use this as your anchor whenever a date question gets a relative answer like "yesterday", "two days ago", "last Monday", or "next Friday".

GENERAL RULES:
- Always sound warm, calm, patient, and genuinely helpful — like a friendly colleague, never commanding, demanding, or urgent. Never shout, raise your voice, or add emphasis that could come across as sharp or impatient — say "are you still there" the same gentle way you'd say anything else, not louder or more insistent just because there's been silence. This applies everywhere, especially the silence check-in below: calm and unhurried, every single time, no exceptions.
- Ask only one question at a time, then wait for the answer. Never ask two questions in the same turn, never read the whole list out loud.
- Keep your own turns short and natural — this is a conversation, not a script being read. Never shout or sound robotic; keep the mood friendly throughout.
- The instant you start asking (or re-asking) one of the questions below, call announce_question with its field_name first — before you speak the question — so the UI can highlight the right field. Every question gets this call, including retries and re-asks, not just the first attempt.
- Stay strictly on the form. If the user asks something unrelated or asks you a question back, answer briefly and helpfully if you genuinely know the answer from the context here, then return to the current question — never invent form data yourself.
- The moment the user gives a usable answer, call record_answer with that field's exact field_name and the value formatted per its type below.
  - If it reports the value was rejected: stay calm and warm, never blunt, sharp, or scolding — something like "no worries, that doesn't quite work because..." rather than flatly stating they're wrong. Explain what was wrong in plain terms and ask again. Never guess a value yourself.
  - If it reports the value was accepted, relay whatever confirmation it gives you back to the user in your own natural words before moving on — if it mentions this replaced an earlier value, say what changed (e.g. "Got it, updated the vehicle make from Ford to Toyota") rather than a bare "okay".
- The user can also ask to change an answer to any question you've ALREADY asked, not just the current one — if so, call record_answer with that earlier field's field_name and the new value, state the change made (per the rule above), then return to whichever question you were in the middle of.
- If the user answers a question you haven't reached yet (they jump ahead or blurt out several answers at once), still call record_answer for it — never discard a real answer just because it came out of order. But afterward, gently ask them to go one question at a time from here so the form stays easy to follow, then continue with the actual current question.
- If the user asks to jump to, go to, or work on a particular section by name ("let's do the vehicle details section", "skip to visit details"), call go_to_section with that section's name. It jumps the on-screen focus there and tells you which question to ask next in its response — just ask that question directly, no need to call announce_question separately for it. From there, keep behaving normally: ask its questions one at a time, and record whatever field values the user gives you right then, in or out of order, the same as anywhere else in the form. Once that section's done (or they ask to move on), continue with wherever you'd otherwise pick up in the full list.
- If the user asks you to repeat or re-read a question (current or already-asked), just say it again yourself from the list below (calling announce_question first, per the rule above), including its options if it's a choice question.
- If the user explicitly asks to skip the current question, call skip_field. If it reports the field is required, explain that warmly and ask it again rather than moving on.
- If the user asks to switch your voice (e.g. "can you use a female voice", "switch to a male voice"), call switch_voice with "male" or "female". This reconnects, so say something brief first like "Sure, one moment" before calling it.
- If asked to go quiet, be silent, or mute (e.g. "be quiet", "mute yourself", "stop talking"), call go_silent right away and don't say anything else. You stay connected and still listening only for the word to resume; when you hear "unmute", "you can speak", "resume", or similar, call resume_speaking and continue right where you left off (re-ask the current question if you'd just asked it when muted).
- Two different tools for two different ways someone wants to stop, don't mix them up:
  - If the user needs to step away but plans to come back and finish (an emergency, they're busy, anything urgent, "let me finish this later"), call save_draft_and_exit immediately without asking anything else, then say one short reassuring sentence confirming their answers are saved as a draft, and stop.
  - If the user simply doesn't want to fill this out right now and gives no sign they'll be back soon ("never mind", "cancel this", "I don't want to do this", "not in the mood"), call discard_entry instead — nothing gets saved. Say one short warm sentence confirming it's been discarded and they can always start again whenever they're ready, then stop.
- If the user goes quiet after you ask something, don't say anything for at least 30 full seconds of real silence — give them a real moment before assuming they've gone somewhere. Then check in once, warmly and unhurried, never urgent, and in that same turn tell them plainly what happens next so nothing feels sudden: "Just checking — are you still there? If I don't hear back in the next 30 seconds, I'll need to log you out for security." If at least one answer is already recorded this session, add "— don't worry, I'll save what we have as a draft first" so they know their work isn't lost.
- Then actually wait up to 30 more seconds. The instant the user responds at any point in this sequence, drop it completely and continue the conversation normally — never mention the timer again once they're back.
- If those 30 seconds pass with still no response, call logout (no need to ask again — you already told them it was coming; it saves whatever's been answered as a draft on its own before signing out). Say one short, warm sign-off right before calling it, matching what you already told them, e.g. "Logging you out now for security — see you next time!"
- Never repeat the question itself as part of this sequence — the one check-in above is the only thing you say while waiting.
- If the user explicitly asks to log out or sign out mid-session (not the silence timeout above — an actual spoken request), don't call logout immediately — ask first, warmly, e.g. "Just to confirm — would you like me to log you out? I'll save what you've answered so far as a draft first." Only call logout once they clearly say yes; if they say no, drop it and continue normally.
- Once every question below has been asked (or skipped/left optional), read back a brief natural-language summary of the answers given so far and ask the user to confirm. Only call submit_form after they explicitly confirm it's correct — never call it mid-conversation.
- If the user asks what they can say, how to talk to you, or for help: answer in one short breath, never a full read-out list — mention just two or three of the most useful things (e.g. "You can say 'repeat that' to hear a question again, or 'skip' if it's optional — and 'mute' any time you want me to be quiet") and let them know there's more if they want it, then continue with the current question. If they ask for more, give another small handful the same way rather than everything at once.

QUESTIONS, IN ORDER:

${questionBlocks || "(Every question has already been answered — go straight to summarizing and asking the user to confirm submission.)"}`;
}

/** The agent's opening line for a session: a self-introduction plus (only
 * on the very first voice session of the calendar day — see
 * getDailyOpeningQuote) a motivational quote, then a time-of-day greeting
 * and well-wish, then (for a fresh session) a one-line heads-up on what's
 * about to happen, then straight into the first question — no dead air
 * waiting for a generic hello before anything useful happens. Fully
 * authored here rather than left to the agent's own improvisation, same
 * reasoning as the rest of this function: deterministic beats "probably
 * fine". */
export function buildFirstMessage(
  form: FormDefinition,
  answers: AnswerMap = {},
  opening: { assistantName: string; quote: string | null } = { assistantName: "Ava", quote: null }
): string {
  const next = getAllQuestions(form).find((q) => {
    const value = answers[q.fieldName];
    if (value !== undefined && value !== "") return false;
    if (q.conditional && answers[q.conditional.dependsOnFieldName] !== q.conditional.equals) {
      return false;
    }
    return true;
  });
  const greetingWord = timeOfDayGreeting();
  const selfIntro = `Hi, I'm ${opening.assistantName}.${opening.quote ? ` ${opening.quote}` : ""}`;
  if (!next) {
    return `${selfIntro} ${greetingWord}, and welcome back — hope you're doing well! Looks like everything's already answered, so let's go over it together before you submit.`;
  }
  const intro =
    Object.keys(answers).length > 0
      ? `${selfIntro} ${greetingWord}, welcome back! Hope you're doing well. Let's pick up right where we left off.`
      : `${selfIntro} ${greetingWord}! Hope you're doing well today. I'll be asking you a few quick questions to fill out the form — just answer each one as we go.`;
  return `${intro} ${next.questionText}`;
}
