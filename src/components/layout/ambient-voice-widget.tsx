"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { Mic, MicOff } from "lucide-react";
import { VoiceOrb, type OrbState } from "@/components/voice/voice-orb";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getVoiceGender } from "@/lib/voice-client";
import { getAssistantName } from "@/lib/voice-session-opening";
import {
  buildAmbientAgentPrompt,
  buildAmbientFirstMessage,
  buildAmbientResumeMessage,
} from "@/lib/ambient-agent-prompt";
import { buildFormBuilderAgentPrompt, buildFormBuilderFirstMessage } from "@/lib/form-builder-agent-prompt";
import { normalizeFieldType, FIELD_TYPE_HINT } from "@/lib/voice-form-builder-validate";
import { useFormBuilderDraft, needsOptions } from "@/lib/form-builder-draft-store";
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

const FORM_BUILDER_ROUTE = "/form-builder/new";

/** Always-on ambient assistant, present on every authenticated page (see
 * (app)/layout.tsx) — a small floating orb on the right edge of the
 * screen, distinct from the form-filling agent in voice-experience.tsx.
 * Connects to a second ElevenLabs agent (?agent=ambient) with its own
 * tool set: navigation, starting/building forms, activating/deactivating
 * forms, resending a customer's PDF email, and logout. While on
 * /form-builder/new specifically, it reconnects to a *third* agent
 * (?agent=form-builder) scoped to voice-driven form building, then
 * reconnects back the moment the user navigates away. */
export function AmbientVoiceWidget() {
  return (
    <ConversationProvider>
      <AmbientVoiceWidgetInner />
    </ConversationProvider>
  );
}

function AmbientVoiceWidgetInner() {
  const router = useRouter();
  const pathname = usePathname();
  const { forms, setFormStatus } = useFormsStore();
  const { entries, upsertEntry } = useEntriesStore();
  const draftStore = useFormBuilderDraft();
  const [connectError, setConnectError] = useState<string | null>(null);
  const isFormBuilderNew = pathname === FORM_BUILDER_ROUTE;

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
  const draftStoreRef = useRef(draftStore);
  useEffect(() => {
    draftStoreRef.current = draftStore;
  }, [draftStore]);

  const conversation = useConversation({
    onError: (message) => {
      console.error("[ambient] agent session error", message);
      setConnectError(message);
    },
    clientTools: {
      // --- Ambient-mode tools (agent=ambient) ---
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
        router.push(FORM_BUILDER_ROUTE);
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

      // --- Form-builder-mode tools (agent=form-builder, only reachable
      // while that agent is connected, i.e. on /form-builder/new) ---
      set_form_name: async (params: { name?: string }) => {
        if (!params.name?.trim()) return "What should the form be called?";
        return draftStoreRef.current.setFormNameByVoice(params.name).message;
      },
      add_question: async (params: {
        question_text?: string;
        field_type?: string;
        required?: string;
        options?: string;
      }) => {
        if (!params.question_text?.trim()) return "I need the question's text to add it.";
        const fieldType = normalizeFieldType(params.field_type ?? "");
        if (!fieldType) {
          return `That's not a type I recognize — it needs to be one of: ${FIELD_TYPE_HINT}.`;
        }
        const required = params.required !== "false";
        const options = needsOptions(fieldType)
          ? (params.options ?? "")
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : [];
        if (needsOptions(fieldType) && options.length === 0) {
          return "That type needs a list of options — what should the choices be?";
        }
        return draftStoreRef.current.addQuestionByVoice({
          questionText: params.question_text,
          fieldType,
          required,
          options,
        }).message;
      },
      remove_question: async (params: { question_text?: string }) => {
        if (!params.question_text?.trim()) return "Which question should I remove?";
        return draftStoreRef.current.removeQuestionByVoice(params.question_text).message;
      },
      save_form: async (params: { status?: string }) => {
        const statusOverride =
          params.status === "active" ? "active" : params.status === "inactive" ? "inactive" : params.status === "draft" ? "draft" : undefined;
        const result = draftStoreRef.current.save(statusOverride);
        if (result.ok) router.push("/form-builder");
        return result.message;
      },
    },
  });

  // A function declaration (not `const`), same reasoning as
  // voice-experience.tsx's connectSession: it's invoked from the
  // auto-connect effect, the mode-change effect, and the orb's click
  // handler (the manual-retry path), so it can't live inside just one.
  // `builderMode` picks which of the two agents to connect to;
  // `isReconnect` (a same-conversation continuation, not the very first
  // connect of the session) picks a short transition line instead of the
  // full name+quote self-introduction.
  async function connectAmbientSession(builderMode: boolean, isReconnect: boolean) {
    setConnectError(null);
    try {
      const agentParam = builderMode ? "form-builder" : "ambient";
      const res = await fetch(`/api/voice/agent-session?agent=${agentParam}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.error || "Couldn't start the ambient assistant");
      }
      const { signedUrl } = await res.json();
      const gender = getVoiceGender();
      const assistantName = getAssistantName(gender);
      const voiceId = gender === "male" ? MALE_VOICE_ID : FEMALE_VOICE_ID;
      const prompt = builderMode
        ? buildFormBuilderAgentPrompt(assistantName)
        : buildAmbientAgentPrompt(assistantName, formsRef.current);
      const firstMessage = builderMode
        ? buildFormBuilderFirstMessage()
        : isReconnect
          ? buildAmbientResumeMessage()
          : buildAmbientFirstMessage(assistantName);
      await conversation.startSession({
        signedUrl,
        overrides: {
          agent: {
            prompt: { prompt },
            firstMessage,
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
    // unlocked autoplay (see audio-unlock.ts). Picks up whichever agent
    // matches wherever the user actually landed (e.g. a direct link or
    // refresh straight into /form-builder/new).
    if (connectedRef.current) return;
    connectedRef.current = true;
    connectAmbientSession(isFormBuilderNew, false);

    return () => {
      conversation.endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconnects to the other agent the moment the route crosses into or
  // out of /form-builder/new. The equality check against the previous
  // value (not just "did this effect run") is what keeps this from
  // double-firing under React StrictMode's dev-only double-invoke, and
  // from doing anything at all on the very first render (the mount effect
  // above already handles that with the correct starting agent).
  const prevIsFormBuilderRef = useRef(isFormBuilderNew);
  useEffect(() => {
    if (prevIsFormBuilderRef.current === isFormBuilderNew) return;
    prevIsFormBuilderRef.current = isFormBuilderNew;
    conversation.endSession();
    connectAmbientSession(isFormBuilderNew, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFormBuilderNew]);

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
            : isFormBuilderNew
              ? "Building your form"
              : "Listening";

  function handleOrbClick() {
    // A disconnected/errored widget (mic permission denied, network blip)
    // gets a manual way back in — clicking just re-runs the same connect
    // logic for whichever mode applies right now.
    if (conversation.status === "connected") return;
    connectedRef.current = true;
    connectAmbientSession(isFormBuilderNew, false);
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
