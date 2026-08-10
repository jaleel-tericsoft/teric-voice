import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// Turns a raw spoken-answer transcript into a structured field value, per
// scope.md's "AI should produce structured data for every answer" rule.
// POST { question, fieldType, options?, transcript } ->
//   { value, confidence, needs_clarification, clarification_question }

const InterpretationSchema = z.object({
  value: z
    .union([z.string(), z.boolean()])
    .describe(
      "The structured answer. For yes_no fields, a boolean. For single_select, the option's value (not label). Otherwise the cleaned-up text/number/date. Empty string if off_topic is true."
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How confident you are that 'value' correctly captures what the user said."),
  needs_clarification: z
    .boolean()
    .describe(
      "True if the answer is a genuine but ambiguous/uncertain attempt to answer the question (e.g. a mumbled number, a vague amount). False if off_topic is true — that's a different case, handled separately."
    ),
  clarification_question: z
    .string()
    .nullable()
    .describe(
      "Only used when needs_clarification is true: a short confirming question restating your best guess, e.g. \"I understood your annual income as ₹8 lakh. Is that correct?\". Otherwise null."
    ),
  off_topic: z
    .boolean()
    .describe(
      "True if the transcript doesn't attempt to answer the question at all — small talk, a question back to the assistant, an unrelated remark, or silence-filler words. False for any genuine (even if unclear) attempt to answer, and false whenever wants_explanation is true."
    ),
  wants_explanation: z
    .boolean()
    .describe(
      "True if the user is asking what the question or a term/word in it means, or asking for an example of what a valid answer looks like (e.g. \"what do you mean by odometer reading\", \"what counts as an upsell\", \"give me an example\"). This is a request for clarification about the form itself, not off_topic — never true at the same time as off_topic."
    ),
  explanation: z
    .string()
    .nullable()
    .describe(
      "Only used when wants_explanation is true: a brief, natural spoken explanation of the question/term, ending with a concrete example of a valid answer. Base this strictly on the question text, field type, and options given below — never introduce outside facts, business details, or anything not derivable from that. Null otherwise."
    ),
  stated_distance_unit: z
    .enum(["km", "miles", "unspecified"])
    .nullable()
    .describe(
      "Only for a number field that is a distance/mileage measurement (e.g. an odometer reading) — which unit the user actually said, if any: 'km' for kilometers/kilometres/kms, 'miles' for miles/mi, or 'unspecified' if they gave a bare number with no unit at all. Null for any field that isn't a distance measurement. Do not convert anything yourself — 'value' must stay the raw number exactly as spoken, in whatever unit they said it in (or with no unit if unspecified); unit conversion happens separately, in code."
    ),
});

const SYSTEM_PROMPT = `You interpret a spoken answer to a form question for a voice-based data entry app.

Given the question, the expected field type, and a raw speech transcript, extract the structured value the user intended — not the raw transcript. Understand natural variation (e.g. "yeah", "I do", "yes I have one" all mean yes for a yes_no field). If options were given for a single_select field, match spoken words to the closest option even if phrased differently.

Three distinct cases — do not conflate them:
- wants_explanation: the user is asking what the question or a term in it means, or wants an example answer. Explain it using only what's in the question/field type/options — never invent outside facts (pricing, policies, business specifics, anything not literally derivable from the question data). Always give a concrete example.
- off_topic: the user didn't attempt to answer and isn't asking for clarification either (small talk, asking the assistant something unrelated). Never guess a value here — the app redirects them back to the form on its own, you don't need to (and must not) answer whatever they said. Stay strictly on the form; don't speculate or make up information outside it.
- needs_clarification: the user did attempt to answer, but it's ambiguous or low-confidence. Ask a short yes/no confirmation of your best guess instead of silently accepting it.

A genuine attempt that's merely informal or imprecise (e.g. "umm, Manchester I think") is neither off_topic nor wants_explanation — interpret it normally, using needs_clarification only if your confidence is genuinely low.

Field type value expectations:
- yes_no: boolean
- single_select: must exactly match one of the given option values
- date: ISO format YYYY-MM-DD
- number: plain digits, e.g. "sixty eight thousand" becomes "68000" — always convert spoken-out numbers to digits, regardless of anything said below about units
- phone, short_text, long_text, email: cleaned-up text (e.g. spelled-out emails like "ahmed dot khan at example dot com" become "ahmed.khan@example.com")

For a number field that's a distance/mileage reading: set stated_distance_unit to whichever unit the user actually said ("km", "miles", or "unspecified" if they gave no unit) — but keep "value" as plain digits in whatever unit they said (e.g. "sixty eight thousand kilometers" -> value "68000", stated_distance_unit "km"). Don't convert the unit yourself — that number-of-digits form is all that's needed, the km-to-miles conversion itself happens afterward in code.

Tone for anything spoken back (clarification_question, explanation): warm, friendly, and polite — like a helpful person, never curt, commanding, or scolding. Calm and genuine, no exclamation marks or forced enthusiasm.`;

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const { question, fieldType, options, transcript } = body ?? {};
  if (!question || !fieldType || typeof transcript !== "string") {
    return NextResponse.json(
      { error: "Missing 'question', 'fieldType', or 'transcript'" },
      { status: 400 }
    );
  }

  if (!transcript.trim()) {
    // Nothing was said — the caller already knows to repeat the question;
    // this endpoint doesn't need to be called for an empty transcript, but
    // handle it defensively rather than sending a pointless request.
    return NextResponse.json({
      value: "",
      confidence: 0,
      needs_clarification: false,
      clarification_question: null,
      off_topic: false,
      wants_explanation: false,
      explanation: null,
      stated_distance_unit: null,
    });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userMessage = [
    `Question: ${question}`,
    `Field type: ${fieldType}`,
    options?.length ? `Options: ${options.join(", ")}` : null,
    `Transcript: "${transcript}"`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await openai.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: zodResponseFormat(InterpretationSchema, "interpretation"),
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      return NextResponse.json(
        { error: "Model did not return parseable output" },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[voice/interpret] OpenAI request failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Interpretation failed", detail }, { status: 502 });
  }
}
