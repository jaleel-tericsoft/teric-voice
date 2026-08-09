import { NextRequest, NextResponse } from "next/server";

// Reads and speaks a form question aloud via ElevenLabs TTS.
// POST { text: string } -> audio/mpeg bytes

// ElevenLabs' well-known default premade voice ("Rachel") — used unless
// ELEVENLABS_VOICE_ID is set. Swap it any time without touching code.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

// Flash is ElevenLabs' lowest-latency model — matters here since this is a
// live back-and-forth conversation, not a batch narration job.
const MODEL_ID = "eleven_flash_v2_5";

export async function POST(req: NextRequest) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const text = body?.text;
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing 'text'" }, { status: 400 });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const detail = errBody?.detail?.message || errBody?.detail || `ElevenLabs returned ${res.status}`;
      console.error("[voice/speak] ElevenLabs TTS request failed", detail);
      return NextResponse.json({ error: "Text-to-speech failed", detail }, { status: 502 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[voice/speak] TTS request failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Text-to-speech failed", detail }, { status: 502 });
  }
}
