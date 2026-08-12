import { NextResponse } from "next/server";

// Both ElevenLabs agents (the form-filling one and the ambient widget's)
// require auth (platform_settings.auth.enable_auth), so a bare agent_id is
// useless to a client on its own — this trades ELEVENLABS_API_KEY
// (server-only) for a short-lived (15 min) signed WebSocket URL the
// browser can actually use to start a conversation. Sits behind proxy.ts's
// login gate like every other /api/voice/* route.
//
// ?agent=ambient picks the ambient widget's agent; anything else (or the
// param omitted) picks the form-filling one, same as before this route
// grew a second agent to serve.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wantsAmbient = searchParams.get("agent") === "ambient";
  const envVarName = wantsAmbient ? "ELEVENLABS_AMBIENT_AGENT_ID" : "ELEVENLABS_AGENT_ID";
  const agentId = process.env[envVarName];

  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }
  if (!agentId) {
    return NextResponse.json(
      { error: `${envVarName} is not configured on the server` },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
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
