import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Turns a recorded answer clip into text.
// POST multipart/form-data, field "audio" -> { transcript: string }
// An empty/near-empty transcript signals "the user didn't answer" — the
// caller (voice-experience.tsx) treats that as a cue to repeat the question.

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'audio' file" }, { status: 400 });
  }

  // Very short clips are almost always silence/noise, not a real answer —
  // skip the API call and report it as unanswered directly.
  if (file.size < 4000) {
    return NextResponse.json({ transcript: "" });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const result = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    return NextResponse.json({ transcript: result.text.trim() });
  } catch (err) {
    console.error("[voice/transcribe] Whisper request failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Transcription failed", detail }, { status: 502 });
  }
}
