import { NextResponse } from "next/server";

// All three ElevenLabs agents (form-filling, ambient widget, form builder)
// require auth (platform_settings.auth.enable_auth), so a bare agent_id is
// useless to a client on its own — this trades ELEVENLABS_API_KEY
// (server-only) for a short-lived (15 min) signed WebSocket URL the
// browser can actually use to start a conversation. Sits behind proxy.ts's
// login gate like every other /api/voice/* route.
//
// ?agent=ambient picks the ambient widget's agent, ?agent=form-builder
// picks the voice-driven form builder's agent (the widget reconnects to
// this one only while on /form-builder/new); anything else (or the param
// omitted) picks the form-filling one, same as before this route grew
// extra agents to serve.

const AGENT_ENV_VARS: Record<string, string> = {
  ambient: "ELEVENLABS_AMBIENT_AGENT_ID",
  "form-builder": "ELEVENLABS_FORM_BUILDER_AGENT_ID",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("agent") ?? "";
  const envVarName = AGENT_ENV_VARS[kind] ?? "ELEVENLABS_AGENT_ID";
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
