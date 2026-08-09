import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// Classifies what the user said at the review stage of a voice-filled form:
// confirm submission, ask to change a specific field, or something unclear.
// Unlike the main Q&A interpret route, this ALWAYS returns a spoken_reply —
// so "change my phone number to..." gets a real response and a real field
// update, instead of being silently ignored because it didn't match "submit".
// POST { transcript, fields: [{fieldName, label, fieldType, options?, currentValue}] }
// -> { intent, field_name, value, spoken_reply }

const ReviewCommandSchema = z.object({
  intent: z
    .enum(["submit", "update_field", "unclear"])
    .describe(
      "submit: user confirmed submission. update_field: user wants to change a specific field's value. unclear: neither — small talk, silence-filler, or a request that isn't about a listed field."
    ),
  field_name: z
    .string()
    .nullable()
    .describe(
      "The fieldName (from the provided list, exact match) the user wants to change. Null unless intent is update_field."
    ),
  value: z
    .union([z.string(), z.boolean()])
    .nullable()
    .describe(
      "The new value, structured per that field's type (yes_no: boolean, single_select: must match an option value, date: YYYY-MM-DD, otherwise text). Null unless intent is update_field."
    ),
  spoken_reply: z
    .string()
    .describe(
      "One short, natural sentence to say back to the user: confirm the change if update_field (e.g. \"Updated your phone number to 9876543210.\"), a brief acknowledgement if submit, or a short nudge on what they can say if unclear (e.g. \"You can say something like 'change my email to...', or say submit when you're ready.\")."
    ),
});

const SYSTEM_PROMPT = `You control a voice-driven review screen for a filled-out form. The user has already answered every question and is now looking at a summary. They can:
1. Confirm submission — "submit", "confirm", "that's correct", "go ahead", "looks good", "yes submit".
2. Ask to change a specific field — "change my phone number to...", "actually my name is...", "make the email ...", "no wait, my city is...".
3. Say something else — small talk, a question, silence-filler, or a request that doesn't match a listed field.

You're given the list of fields (fieldName, label, type, options if any, current value) and the transcript. Decide the intent. For update_field, pick the field whose label most plausibly matches what they're talking about, and extract the new value in the correct format for its type. Always write a short, natural spoken_reply — the user should always hear something back, never silence.`;

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const { transcript, fields } = body ?? {};
  if (typeof transcript !== "string" || !Array.isArray(fields)) {
    return NextResponse.json(
      { error: "Missing 'transcript' or 'fields'" },
      { status: 400 }
    );
  }

  if (!transcript.trim()) {
    return NextResponse.json({
      intent: "unclear",
      field_name: null,
      value: null,
      spoken_reply: "I didn't catch that. You can say submit, or ask to change a field.",
    });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const fieldsList = fields
    .map(
      (f: { fieldName: string; label: string; fieldType: string; options?: string[]; currentValue?: unknown }) =>
        `- ${f.fieldName} (${f.label}) [type: ${f.fieldType}${f.options?.length ? `, options: ${f.options.join(", ")}` : ""}] current value: ${f.currentValue ?? "—"}`
    )
    .join("\n");

  const userMessage = `Fields:\n${fieldsList}\n\nTranscript: "${transcript}"`;

  try {
    const completion = await openai.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: zodResponseFormat(ReviewCommandSchema, "review_command"),
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
    console.error("[voice/review-command] OpenAI request failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Review command failed", detail }, { status: 502 });
  }
}
