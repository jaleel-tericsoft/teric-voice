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
          // Same settings object for every request regardless of which
          // voice was picked — female and male get identical treatment,
          // never a voice-specific tweak.
          //
          // Previously stability: 0.42 / style: 0.3, chosen for a more
          // expressive, less robotic read. In practice that pushed some
          // premade voices (Rachel/female noticeably more than Adam/male)
          // past what eleven_flash_v2_5 renders reliably at — clipped or
          // dropped words and occasional mispronunciation. Both knobs are
          // pulled back toward ElevenLabs' own reliability guidance: higher
          // stability and lower style consistently reduce those artifacts,
          // at the cost of a little of the expressiveness the lower values
          // were going for. similarity_boost/use_speaker_boost are
          // unrelated to that failure mode and are unchanged.
          voice_settings: {
            stability: 0.58,
            similarity_boost: 0.8,
            style: 0.12,
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
