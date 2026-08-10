import { NextRequest, NextResponse } from "next/server";

// Reads and speaks a form question aloud via ElevenLabs TTS.
// POST { text: string, voice?: "female" | "male" } -> audio/mpeg bytes

// ElevenLabs' well-known premade voices — Rachel (female) and Adam (male).
// ELEVENLABS_VOICE_ID, if set, overrides the female/default pick only —
// an explicit voice="male" from the client always wins, since that's a
// deliberate in-app choice.
const FEMALE_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const MALE_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam

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

  const voiceId =
    body?.voice === "male"
      ? MALE_VOICE_ID
      : body?.voice === "female"
        ? FEMALE_VOICE_ID
        : process.env.ELEVENLABS_VOICE_ID || FEMALE_VOICE_ID;

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
          // Tuned for a more natural, conversational delivery rather than a
          // flat/robotic read: stability slightly below default lets some
          // natural pitch/pace variation through, a touch of style adds
          // expressiveness, and speaker boost improves clarity/fidelity.
          voice_settings: {
            stability: 0.42,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true,
          },
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
