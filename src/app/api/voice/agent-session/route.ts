import { NextResponse } from "next/server";

// The ElevenLabs agent requires auth (platform_settings.auth.enable_auth),
// so a bare agent_id is useless to a client on its own — this trades
// ELEVENLABS_API_KEY (server-only) for a short-lived (15 min) signed
// WebSocket URL the browser can actually use to start a conversation.
// Sits behind proxy.ts's login gate like every other /api/voice/* route.

export async function GET() {
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }
  if (!process.env.ELEVENLABS_AGENT_ID) {
    return NextResponse.json(
      { error: "ELEVENLABS_AGENT_ID is not configured on the server" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(process.env.ELEVENLABS_AGENT_ID)}`,
      { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY } }
    );
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const detail = errBody?.detail?.message || errBody?.detail || `ElevenLabs returned ${res.status}`;
      console.error("[voice/agent-session] failed to get signed URL", detail);
      return NextResponse.json({ error: "Couldn't start a voice session", detail }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (err) {
    console.error("[voice/agent-session] request failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Couldn't start a voice session", detail }, { status: 502 });
  }
}
