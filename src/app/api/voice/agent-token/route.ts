import { NextResponse } from "next/server";

// The WebRTC sibling of agent-session/route.ts.
//
// Same trade — ELEVENLABS_API_KEY (server-only) for a short-lived credential a
// client can use — but mints a WebRTC conversation token rather than a signed
// WebSocket URL. It exists because the React Native SDK cannot use the signed
// URL this app's browser clients use: on React Native the ElevenLabs client
// refuses a WebSocket connection outright ("WebSocket connections are not
// supported on React Native. Only WebRTC connections are available."), since
// audio there goes through LiveKit's native WebRTC stack.
//
// The browser keeps using agent-session; nothing about the web app changes.
//
// ?agent= selects which agent, matching agent-session's own convention.

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
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY } }
    );
    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const detail =
        errBody?.detail?.message || errBody?.detail || `ElevenLabs returned ${res.status}`;
      console.error("[voice/agent-token] failed to get conversation token", detail);
      return NextResponse.json(
        { error: "Couldn't start a voice session", detail },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json({ conversationToken: data.token });
  } catch (err) {
    console.error("[voice/agent-token] request failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Couldn't start a voice session", detail }, { status: 502 });
  }
}
