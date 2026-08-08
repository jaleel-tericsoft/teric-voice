import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// Turns a raw spoken-answer transcript into a structured field value, per
// scope.md's "AI should produce structured data for every answer" rule.
// POST { question, fieldType, options?, transcript } ->
//   { value, confidence, needs_clarification, clarification_question }

const InterpretationSchema = z.object({
  value: z
    .union([z.string(), z.boolean()])
    .describe(
      "The structured answer. For yes_no fields, a boolean. For single_select, the option's value (not label). Otherwise the cleaned-up text/number/date."
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How confident you are that 'value' correctly captures what the user said."),
  needs_clarification: z
    .boolean()
    .describe("True if the answer is ambiguous, off-topic, or too uncertain to populate the field."),
  clarification_question: z
    .string()
    .nullable()
    .describe(
      "If needs_clarification is true, a short confirming question to ask the user, e.g. \"I understood your annual income as ₹8 lakh. Is that correct?\". Otherwise null."
    ),
});

const SYSTEM_PROMPT = `You interpret a spoken answer to a form question for a voice-based data entry app.

Given the question, the expected field type, and a raw speech transcript, extract the structured value the user intended — not the raw transcript. Understand natural variation (e.g. "yeah", "I do", "yes I have one" all mean yes for a yes_no field).

Never silently guess on ambiguous, incomplete, or off-topic answers — set needs_clarification to true instead, with a short spoken confirmation question that restates your best guess.

Field type value expectations:
- yes_no: boolean
- single_select: must exactly match one of the given option values
- date: ISO format YYYY-MM-DD
- phone, number, short_text, long_text, email: cleaned-up text (e.g. spelled-out emails like "ahmed dot khan at example dot com" become "ahmed.khan@example.com")`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
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
    });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userMessage = [
    `Question: ${question}`,
    `Field type: ${fieldType}`,
    options?.length ? `Options: ${options.join(", ")}` : null,
    `Transcript: "${transcript}"`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: 512,
      thinking: { type: "disabled" },
      output_config: {
        effort: "low",
        format: zodOutputFormat(InterpretationSchema),
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    if (!response.parsed_output) {
      return NextResponse.json(
        { error: "Model did not return parseable output" },
        { status: 502 }
      );
    }

    return NextResponse.json(response.parsed_output);
  } catch (err) {
    console.error("[voice/interpret] Claude request failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Interpretation failed", detail }, { status: 502 });
  }
}
