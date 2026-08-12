"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { Mic, MicOff } from "lucide-react";
import { VoiceOrb, type OrbState } from "@/components/voice/voice-orb";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getVoiceGender } from "@/lib/voice-client";
import { getAssistantName } from "@/lib/voice-session-opening";
import { buildAmbientAgentPrompt, buildAmbientFirstMessage } from "@/lib/ambient-agent-prompt";
import { useFormsStore } from "@/lib/forms-store";
import {
  useEntriesStore,
  findEntryByIdentifier,
  resolveRecipientEmail,
  withCustomerEmail,
  withEmailResent,
} from "@/lib/entries-store";
import { performLogout } from "@/lib/logout";

const FEMALE_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const MALE_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam

const PAGE_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  entries: "/entries",
  "form-builder": "/form-builder",
  formbuilder: "/form-builder",
  settings: "/settings",
};

/** Always-on ambient assistant, present on every authenticated page (see
 * (app)/layout.tsx) — a small floating orb on the right edge of the
 * screen, distinct from the form-filling agent in voice-experience.tsx.
 * Connects to a second ElevenLabs agent (?agent=ambient) with its own,
 * smaller tool set: navigation, starting/building forms, activating/
 * deactivating forms, resending a customer's PDF email, and logout. */
export function AmbientVoiceWidget() {
  return (
    <ConversationProvider>
      <AmbientVoiceWidgetInner />
    </ConversationProvider>
  );
}

function AmbientVoiceWidgetInner() {
  const router = useRouter();
  const { forms, setFormStatus } = useFormsStore();
  const { entries, upsertEntry } = useEntriesStore();
  const [connectError, setConnectError] = useState<string | null>(null);

  // Client tool closures run inside the SDK's own event handling, not a
  // React render — same stale-closure-avoidance pattern as
  // voice-experience.tsx: mirror the latest store data into refs so the
  // long-lived tool handlers below always read current data.
  const formsRef = useRef(forms);
  useEffect(() => {
    formsRef.current = forms;
  }, [forms]);
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const conversation = useConversation({
    onError: (message) => {
      console.error("[ambient] agent session error", message);
      setConnectError(message);
    },
    clientTools: {
      navigate_to: async (params: { page?: string }) => {
        const key = (params.page ?? "").trim().toLowerCase().replace(/\s+/g, "-");
        const target = PAGE_ROUTES[key];
        if (!target) {
          return 'Unknown page — must be one of: dashboard, entries, form-builder, settings.';
        }
        router.push(target);
        return `Navigating to ${params.page}.`;
      },
      start_form_filling: async (params: { form_name?: string }) => {
        const active = formsRef.current.filter((f) => f.status === "active");
        if (active.length === 0) return "There are no active forms to fill out right now.";

        let target = active[0];
        if (params.form_name?.trim()) {
          const needle = params.form_name.trim().toLowerCase();
          const match =
            active.find((f) => f.name.toLowerCase() === needle) ??
            active.find((f) => f.name.toLowerCase().includes(needle));
          if (!match) {
            return `Couldn't find an active form called "${params.form_name}". Active forms: ${active.map((f) => f.name).join(", ")}.`;
          }
          target = match;
        } else if (active.length > 1) {
          return `There's more than one active form — which one did you mean? Options: ${active.map((f) => f.name).join(", ")}.`;
        }

        router.push(`/voice/new?form=${target.formId}`);
        return `Starting ${target.name} now.`;
      },
      start_form_builder: async () => {
        router.push("/form-builder/new");
        return "Opening the form builder.";
      },
      toggle_form_status: async (params: { form_name?: string; status?: string }) => {
        if (!params.form_name?.trim()) return "I need a form name to know which one to update.";
        const status = params.status === "inactive" ? "inactive" : params.status === "active" ? "active" : null;
        if (!status) return 'Status must be "active" or "inactive".';

        const needle = params.form_name.trim().toLowerCase();
        const currentForms = formsRef.current;
        const target =
          currentForms.find((f) => f.name.toLowerCase() === needle) ??
          currentForms.find((f) => f.name.toLowerCase().includes(needle));
        if (!target) {
          return `Couldn't find a form called "${params.form_name}". Forms: ${currentForms.map((f) => f.name).join(", ")}.`;
        }
        setFormStatus(target.id, status);
        return `${target.name} is now ${status}.`;
      },
      resend_pdf_email: async (params: { entry_identifier?: string }) => {
        if (!params.entry_identifier?.trim()) {
          return "I need an entry ID or number plate to know which one to resend.";
        }
        const entry = findEntryByIdentifier(entriesRef.current, params.entry_identifier);
        if (!entry) return `Couldn't find an entry matching "${params.entry_identifier}".`;

        const recipient = resolveRecipientEmail(entry);
        if (!recipient) {
          return "There's no email on file for this customer yet — ask the user for one, then call record_customer_email with it.";
        }
        upsertEntry(withEmailResent(entry, recipient));
        return `Resent the PDF to ${recipient}.`;
      },
      record_customer_email: async (params: { entry_identifier?: string; email?: string }) => {
        if (!params.entry_identifier?.trim() || !params.email?.trim()) {
          return "I need both the entry and an email address.";
        }
        const entry = findEntryByIdentifier(entriesRef.current, params.entry_identifier);
        if (!entry) return `Couldn't find an entry matching "${params.entry_identifier}".`;

        const email = params.email.trim();
        upsertEntry(withEmailResent(withCustomerEmail(entry, email), email));
        return `Got it — sent the PDF to ${email}.`;
      },
      logout: async () => {
        await performLogout();
        router.push("/login");
        router.refresh();
        return "Logging out now.";
      },
    },
  });

  // A function declaration (not `const`), same reasoning as
  // voice-experience.tsx's connectSession: it's invoked both from the
  // auto-connect effect below and directly from the orb's click handler
  // (the manual-retry path), so it can't live inside just one of them.
  async function connectAmbientSession() {
    setConnectError(null);
    try {
      const res = await fetch("/api/voice/agent-session?agent=ambient");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.error || "Couldn't start the ambient assistant");
      }
      const { signedUrl } = await res.json();
      const gender = getVoiceGender();
      const assistantName = getAssistantName(gender);
      const voiceId = gender === "male" ? MALE_VOICE_ID : FEMALE_VOICE_ID;
      await conversation.startSession({
        signedUrl,
        overrides: {
          agent: {
            prompt: { prompt: buildAmbientAgentPrompt(assistantName, formsRef.current) },
            firstMessage: buildAmbientFirstMessage(assistantName),
            language: "en",
          },
          tts: { voiceId },
        },
      });
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : String(err));
    }
  }

  const connectedRef = useRef(false);
  useEffect(() => {
    // Auto-connects once, the moment this widget first mounts (which,
    // mounted at the (app) layout level, means right after login lands on
    // /dashboard) — no click needed since login's own submit already
    // unlocked autoplay (see audio-unlock.ts).
    if (connectedRef.current) return;
    connectedRef.current = true;
    connectAmbientSession();

    return () => {
      conversation.endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orbState: OrbState =
    conversation.status === "connecting"
      ? "thinking"
      : conversation.status !== "connected"
        ? "idle"
        : conversation.mode === "speaking"
          ? "speaking"
          : "listening";

  const statusLabel = connectError
    ? "Tap to reconnect"
    : conversation.status === "connecting"
      ? "Connecting…"
      : conversation.status !== "connected"
        ? "Tap to connect"
        : conversation.isMuted
          ? "Muted"
          : conversation.mode === "speaking"
            ? "Speaking"
            : "Listening";

  function handleOrbClick() {
    // A disconnected/errored widget (mic permission denied, network blip)
    // gets a manual way back in — clicking just re-runs the same connect
    // logic the mount effect used.
    if (conversation.status === "connected") return;
    connectedRef.current = true;
    connectAmbientSession();
  }

  return (
    <div className="fixed right-5 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleOrbClick}
            aria-label={statusLabel}
            className="cursor-pointer rounded-full"
          >
            <VoiceOrb state={orbState} size={56} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">{statusLabel}</TooltipContent>
      </Tooltip>
      {conversation.status === "connected" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => conversation.setMuted(!conversation.isMuted)}
              aria-label={conversation.isMuted ? "Unmute assistant" : "Mute assistant"}
              className="flex size-7 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm ring-1 ring-border/60 transition-colors hover:text-foreground"
            >
              {conversation.isMuted ? (
                <MicOff className="size-3.5" />
              ) : (
                <Mic className="size-3.5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {conversation.isMuted ? "Unmute" : "Mute"}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
