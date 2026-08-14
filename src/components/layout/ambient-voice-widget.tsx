"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { Mic, MicOff } from "lucide-react";
import { VoiceOrb, type OrbState } from "@/components/voice/voice-orb";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getVoiceGender,
  setVoiceGender,
  getVoiceLanguage,
  VOICE_PREFERENCE_CHANGED_EVENT,
  type VoiceGender,
} from "@/lib/voice-client";
import { getAssistantName, buildVoiceSwitchedMessage } from "@/lib/voice-session-opening";
import {
  buildAmbientAgentPrompt,
  buildAmbientFirstMessage,
  buildAmbientResumeMessage,
} from "@/lib/ambient-agent-prompt";
import { buildFormBuilderAgentPrompt, buildFormBuilderFirstMessage } from "@/lib/form-builder-agent-prompt";
import { normalizeFieldType, FIELD_TYPE_HINT } from "@/lib/voice-form-builder-validate";
import { useFormBuilderDraft, needsOptions, type MoveDirection } from "@/lib/form-builder-draft-store";
import { useEntriesFilterStore } from "@/lib/entries-filter-store";
import { useFormsStore } from "@/lib/forms-store";
import {
  useEntriesStore,
  findEntryByIdentifier,
  resolveRecipientEmail,
  withCustomerEmail,
  withEmailResent,
} from "@/lib/entries-store";
import { performLogout } from "@/lib/logout";
import { recordVoiceActivity } from "@/lib/use-idle-logout";
import { consumePendingSubmissionAnnouncement } from "@/lib/submission-announcement";
import { consumePendingInstructionsOffer } from "@/lib/instructions-offer";

const FEMALE_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const MALE_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam

const PAGE_ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  entries: "/entries",
  "form-builder": "/form-builder",
  formbuilder: "/form-builder",
  settings: "/settings",
};

const SETTINGS_ROUTE = "/settings";
const FORM_BUILDER_ROUTE = "/form-builder/new";

function asDirection(v: unknown): MoveDirection | null {
  return v === "up" ? "up" : v === "down" ? "down" : null;
}

function isConfirmed(v: unknown): boolean {
  return v === "true" || v === true;
}

/** Always-on ambient assistant, present on every authenticated page (see
 * (app)/layout.tsx) — a small floating panel anchored to the bottom-right
 * corner, styled like the voice-filling experience's own control bar
 * (voice-experience.tsx), distinct from that agent entirely. Connects to
 * a second ElevenLabs agent (?agent=ambient) with its own tool set:
 * navigation, starting/building forms, activating/deactivating forms,
 * resending a customer's PDF email, switching voice, going quiet on
 * request, and logout. While on /form-builder/new specifically, it
 * reconnects to a *third* agent (?agent=form-builder) scoped to
 * voice-driven form building, then reconnects back the moment the user
 * navigates away.
 *
 * Voice/language themselves aren't configurable from here anymore — that
 * now lives solely in Settings (Voice & AI). This widget just listens for
 * VOICE_PREFERENCE_CHANGED_EVENT and reconnects with whatever's current. */
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
  const entriesFilterStore = useEntriesFilterStore();
  const [connectError, setConnectError] = useState<string | null>(null);
  // Set by the voice-triggered go_silent/resume_speaking tools — distinct
  // from the manual mute button below (which cuts the mic entirely, so it
  // could never hear "unmute"). This instead silences the assistant's own
  // output (conversation.setVolume) while leaving the mic live, so it can
  // still hear the word to resume.
  const [silenced, setSilenced] = useState(false);
  const isFormBuilderNew = pathname === FORM_BUILDER_ROUTE;

  // Client tool closures run inside the SDK's own event handling, not a
  // React render — same stale-closure-avoidance pattern as
  // voice-experience.tsx: mirror the latest store data into refs so the
  // long-lived tool handlers below always read current data. This is now
  // load-bearing for more than staleness, too — see the note above
  // `clientTools` on why every one of these has to be ref-based.
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
  const entriesFilterStoreRef = useRef(entriesFilterStore);
  useEffect(() => {
    entriesFilterStoreRef.current = entriesFilterStore;
  }, [entriesFilterStore]);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const isFormBuilderNewRef = useRef(isFormBuilderNew);
  useEffect(() => {
    isFormBuilderNewRef.current = isFormBuilderNew;
  }, [isFormBuilderNew]);
  // The conversation object itself changes identity on essentially every
  // render (its own mode/status are part of what triggers those renders),
  // so anything that needs to call its methods from a handler that isn't
  // itself recreated every render (see clientTools below) has to go
  // through this instead of closing over `conversation` directly.
  const conversationRef = useRef<ReturnType<typeof useConversation> | null>(null);

  // clientTools was previously an inline object literal passed straight
  // into useConversation() below — recreated fresh on *every* render.
  // Because this widget wraps the whole authenticated app, it re-renders
  // far more often than voice-experience.tsx ever does (any change to
  // forms/entries/the form-builder draft, anywhere in the app, plus every
  // mode/status change of its own live session), and hooks like this one
  // often tear down and re-establish their underlying connection when the
  // tools/config identity changes between renders. That's what was
  // actually behind "goes off and reconnects on its own, and keeps ending
  // up muted" — each unwanted reconnect ran connectAmbientSession, which
  // (correctly, on a real reconnect) starts the session muted, but here
  // it was happening constantly. Memoizing this with an empty dependency
  // array gives the SDK one stable object for the widget's whole
  // lifetime; every handler below reads current data through a ref
  // instead of a closed-over value, precisely so that "stable forever" is
  // safe rather than "frozen with stale data forever".
  const clientTools = useMemo(
    () => ({
      // --- Ambient-mode tools (agent=ambient) ---
      navigate_to: async (params: { page?: string; form_name?: string }) => {
        const key = (params.page ?? "").trim().toLowerCase().replace(/\s+/g, "-");
        const target = PAGE_ROUTES[key];
        if (!target) {
          return 'Unknown page — must be one of: dashboard, entries, form-builder, settings.';
        }

        let destination = target;
        let matchedFormName: string | null = null;
        if (key === "entries" && params.form_name?.trim()) {
          const needle = params.form_name.trim().toLowerCase();
          const match =
            formsRef.current.find((f) => f.name.toLowerCase() === needle) ??
            formsRef.current.find((f) => f.name.toLowerCase().includes(needle));
          if (match) {
            destination = `/entries?form=${match.formId}`;
            matchedFormName = match.name;
          }
        }

        // Only short-circuits on "already here" for a plain page nav —
        // once a form filter is involved the current pathname alone
        // (usePathname() excludes the query string) can't tell us
        // whether the *same* filter is already active, so it's safer to
        // just navigate again than risk a false "we're already here".
        const current = pathnameRef.current ?? "";
        if (!matchedFormName && (current === target || current.startsWith(`${target}/`))) {
          return "We're already here.";
        }

        router.push(destination);
        return matchedFormName
          ? `Navigating to ${matchedFormName}'s entries.`
          : `Navigating to ${params.page}.`;
      },
      filter_entries: async (params: { field?: string; value?: string }) => {
        if (!params.value?.trim()) return "What value should that filter match? Ask the user to clarify.";
        return entriesFilterStoreRef.current.filterByVoice(params.field ?? "", params.value).message;
      },
      reset_entries_filters: async () => {
        return entriesFilterStoreRef.current.resetFilters().message;
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
        if (target.status === "draft") {
          return `"${target.name}" is still a draft — publish it from the editor first, then it can be activated or deactivated.`;
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
      // Voice/language now live only in Settings — this still works from
      // anywhere, but confirms first unless already on the Settings page,
      // since it's changing something the user isn't looking at.
      switch_voice: async (params: { gender?: string; confirmed?: string }) => {
        const gender: VoiceGender | null =
          params.gender === "male" ? "male" : params.gender === "female" ? "female" : null;
        if (!gender) return 'Unknown gender — must be "male" or "female".';

        const onSettingsPage = pathnameRef.current === SETTINGS_ROUTE;
        if (!onSettingsPage && !isConfirmed(params.confirmed)) {
          return `Ask the user to confirm first, since they're not on the Settings page right now — say something like "I'll switch to a ${gender} voice and update this in Settings too — is that okay?" Only call switch_voice again with confirmed set to "true" once they clearly agree.`;
        }

        setVoiceGender(gender);
        // Same brief delay as voice-experience.tsx's own switch_voice —
        // gives this tool's spoken return value a moment to actually play
        // before endSession/startSession tears the session down.
        window.setTimeout(() => {
          conversationRef.current?.endSession();
          connectAmbientSession(isFormBuilderNewRef.current, "voice-switched", gender);
        }, 600);
        return onSettingsPage
          ? `Switching to a ${gender} voice now.`
          : `Switching to a ${gender} voice now — updated in Settings too.`;
      },
      // Prompt requires a spoken confirmation before this ever gets
      // called (see ambient-agent-prompt.ts) — by the time it's called,
      // the user has already said yes, so it acts immediately.
      logout: async () => {
        await performLogout();
        router.push("/login");
        router.refresh();
        return "Logging out now.";
      },

      // --- Silence, shared by both agents (ambient + form-builder) ---
      go_silent: async () => {
        setSilenced(true);
        conversationRef.current?.setVolume({ volume: 0 });
        return "ok";
      },
      resume_speaking: async () => {
        setSilenced(false);
        conversationRef.current?.setVolume({ volume: 1 });
        return "I'm back.";
      },

      // --- Form-builder-mode tools (agent=form-builder, only reachable
      // while that agent is connected, i.e. on /form-builder/new) ---
      set_form_name: async (params: { name?: string }) => {
        if (!params.name?.trim()) return "What should the form be called?";
        return draftStoreRef.current.setFormNameByVoice(params.name).message;
      },
      set_form_description: async (params: { description?: string }) => {
        if (!params.description?.trim()) return "What should the description say?";
        return draftStoreRef.current.setDescriptionByVoice(params.description).message;
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
      update_question: async (params: {
        question_text?: string;
        new_question_text?: string;
        field_type?: string;
        required?: string;
        options?: string;
      }) => {
        if (!params.question_text?.trim()) return "Which question should I change?";
        let fieldType;
        if (params.field_type?.trim()) {
          fieldType = normalizeFieldType(params.field_type) ?? undefined;
          if (!fieldType) {
            return `That's not a type I recognize — it needs to be one of: ${FIELD_TYPE_HINT}.`;
          }
        }
        return draftStoreRef.current.updateQuestionByVoice(params.question_text, {
          questionText: params.new_question_text,
          fieldType,
          required: params.required === undefined ? undefined : params.required !== "false",
          options: params.options
            ? params.options.split(",").map((o) => o.trim()).filter(Boolean)
            : undefined,
        }).message;
      },
      move_question: async (params: { question_text?: string; direction?: string }) => {
        if (!params.question_text?.trim()) return "Which question should I move?";
        const direction = asDirection(params.direction);
        if (!direction) return 'Direction must be "up" or "down".';
        return draftStoreRef.current.moveQuestionByVoice(params.question_text, direction).message;
      },
      add_section: async (params: { title?: string }) => {
        return draftStoreRef.current.addSectionByVoice(params.title).message;
      },
      set_section_title: async (params: { section?: string; title?: string }) => {
        if (!params.section?.trim() || !params.title?.trim()) {
          return "I need to know which section, and its new title.";
        }
        return draftStoreRef.current.setSectionTitleByVoice(params.section, params.title).message;
      },
      move_section: async (params: { section?: string; direction?: string }) => {
        if (!params.section?.trim()) return "Which section should I move?";
        const direction = asDirection(params.direction);
        if (!direction) return 'Direction must be "up" or "down".';
        return draftStoreRef.current.moveSectionByVoice(params.section, direction).message;
      },
      // Destructive (removes every question in the section too), so this
      // always requires confirmation first — the prompt is told to ask,
      // then call again with confirmed set to "true".
      remove_section: async (params: { section?: string; confirmed?: string }) => {
        if (!params.section?.trim()) return "Which section should I remove?";
        if (!isConfirmed(params.confirmed)) {
          return `Ask the user to confirm before deleting — say something like "Just to confirm, delete the ${params.section} section and all its questions?" Only call remove_section again with confirmed set to "true" once they say yes.`;
        }
        return draftStoreRef.current.removeSectionByVoice(params.section).message;
      },
      toggle_entry_column: async (params: { field?: string }) => {
        if (!params.field?.trim()) return "Which field?";
        return draftStoreRef.current.toggleEntryColumnByVoice(params.field).message;
      },
      save_form: async (params: { status?: string }) => {
        const statusOverride =
          params.status === "active" ? "active" : params.status === "inactive" ? "inactive" : params.status === "draft" ? "draft" : undefined;
        const result = draftStoreRef.current.save(statusOverride);
        if (result.ok) router.push("/form-builder");
        return result.message;
      },
    }),
    // Deliberately empty — every handler above reads current data via a
    // ref (or a stable setState setter), never a closed-over value, so
    // this object never needs to change identity. See the comment above
    // clientTools for why that stability is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const conversation = useConversation({
    onError: (message) => {
      console.error("[ambient] agent session error", message);
      setConnectError(message);
    },
    // Every real turn — the user's own speech transcribed, or the agent
    // replying — counts as the "voice activity" the idle-logout timer
    // resets on (see use-idle-logout.ts: this app runs hands-free, so
    // mouse/keyboard were never the right signal for it).
    onMessage: () => recordVoiceActivity(),
    clientTools,
  });
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // Also covers the moment speech starts, slightly ahead of onMessage
  // (which fires once a transcript is final) — the agent actively
  // talking is itself activity, not just what it said afterward.
  useEffect(() => {
    if (conversation.mode === "speaking") recordVoiceActivity();
  }, [conversation.mode]);

  // See connectAmbientSession's comment on why this is deferred to a
  // reactive "status just became connected" effect instead of running
  // right after startSession()'s promise resolves.
  const needsPostConnectSetupRef = useRef(false);
  useEffect(() => {
    if (conversation.status !== "connected" || !needsPostConnectSetupRef.current) return;
    needsPostConnectSetupRef.current = false;
    // Fresh session: neither of these should carry over from before.
    setSilenced(false);
    conversation.setVolume({ volume: 1 });
  }, [conversation.status, conversation]);

  // A function declaration (not `const`), same reasoning as
  // voice-experience.tsx's connectSession: it's invoked from the
  // auto-connect effect, the mode-change effect, the preference-change
  // listener, switch_voice above, and the orb's click handler (the
  // manual-retry path), so it can't live inside just one of them. It only
  // ever talks to the SDK through conversationRef, same reasoning as
  // clientTools — switch_voice's reference to this function is itself
  // effectively "frozen" at first-render (captured once, inside the
  // memoized clientTools), so anything it touches has to be ref-safe too,
  // not just its own direct SDK calls. `builderMode` picks which of the
  // two agents to connect to; `reconnectReason` (omitted entirely on the
  // very first connect of the session) picks which opening line applies:
  // "voice-switched" gets a full name+greeting reintroduction (the voice
  // actually changed, so it should sound like it), "mode-return" gets a
  // short transition line (just crossing between the ambient and
  // form-builder agents, same voice throughout), and omitted gets the
  // full first-ever-login opening (name, daily quote if still owed,
  // submission/instructions extras). `genderOverride` exists because a
  // just-confirmed voice switch needs its new value applied immediately,
  // and there's no React state here to read back on the next render
  // anymore (gender lives in localStorage only) — getVoiceGender() would
  // just return the same value being set in this exact call otherwise.
  async function connectAmbientSession(
    builderMode: boolean,
    reconnectReason?: "voice-switched" | "mode-return",
    genderOverride?: VoiceGender
  ) {
    setConnectError(null);
    try {
      const agentParam = builderMode ? "form-builder" : "ambient";
      const res = await fetch(`/api/voice/agent-session?agent=${agentParam}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.error || "Couldn't start the ambient assistant");
      }
      const { signedUrl } = await res.json();
      const gender = genderOverride ?? getVoiceGender();
      const lang = getVoiceLanguage();
      const assistantName = getAssistantName(gender);
      const voiceId = gender === "male" ? MALE_VOICE_ID : FEMALE_VOICE_ID;
      const prompt = builderMode
        ? buildFormBuilderAgentPrompt(assistantName)
        : buildAmbientAgentPrompt(assistantName, formsRef.current);
      const firstMessage =
        reconnectReason === "voice-switched"
          ? buildVoiceSwitchedMessage(assistantName)
          : builderMode
            ? buildFormBuilderFirstMessage()
            : reconnectReason === "mode-return"
              ? buildAmbientResumeMessage()
              : buildAmbientFirstMessage(
                  assistantName,
                  consumePendingSubmissionAnnouncement(),
                  consumePendingInstructionsOffer()
                );
      // Marks that the next time conversation.status actually reports
      // "connected" (observed reactively, below), this session still
      // needs its post-connect setup done. Deliberately NOT done right
      // here, immediately after this await resolves — the SDK's own
      // internal "active conversation" state hadn't always caught up by
      // that point, and calling setVolume/setMuted a beat too early threw
      // "No active conversation. Call startSession() first." even though
      // startSession() itself had already resolved without error.
      needsPostConnectSetupRef.current = true;
      await conversationRef.current?.startSession({
        signedUrl,
        overrides: {
          agent: {
            prompt: { prompt },
            firstMessage,
            language: lang,
          },
          tts: { voiceId },
        },
      });
    } catch (err) {
      console.error("[ambient] connect failed", err);
      setConnectError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    // Auto-connects once, the moment this widget first mounts (which,
    // mounted at the (app) layout level, means right after login lands on
    // /dashboard) — no click needed since login's own submit already
    // unlocked autoplay (see audio-unlock.ts). Picks up whichever agent
    // matches wherever the user actually landed (e.g. a direct link or
    // refresh straight into /form-builder/new).
    //
    // Deferred by a tick (and cancellable) specifically to survive React
    // StrictMode's dev-only mount→cleanup→mount double-invoke unharmed:
    // without this, the *first* (soon-to-be-discarded) invocation's
    // cleanup called endSession() while that same invocation's connect
    // was still in flight, and the SDK appears to honor that disconnect
    // the moment the real connection actually completes a beat later —
    // surfacing as "connects, starts speaking, then immediately
    // disconnects" on every fresh load. Deferring the connect past the
    // StrictMode dance (and cancelling it if cleanup fires first) means
    // the earliest possible endSession() call always lands on a session
    // that never started, instead of one that's mid-handshake.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) connectAmbientSession(isFormBuilderNew);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      conversationRef.current?.endSession();
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
    conversationRef.current?.endSession();
    connectAmbientSession(isFormBuilderNew, "mode-return");
  }, [isFormBuilderNew]);

  // Voice/language changed from Settings — reconnect live with whatever's
  // now current, rather than only picking it up whenever this widget next
  // happens to reconnect for some unrelated reason. A same-tab
  // localStorage write doesn't fire the native `storage` event (that only
  // reaches *other* tabs), hence the custom event. Treated the same as an
  // in-conversation switch_voice — a fresh name+greeting reintroduction,
  // since either a voice or a language change came from here.
  useEffect(() => {
    function handlePreferenceChange() {
      conversationRef.current?.endSession();
      connectAmbientSession(isFormBuilderNewRef.current, "voice-switched");
    }
    window.addEventListener(VOICE_PREFERENCE_CHANGED_EVENT, handlePreferenceChange);
    return () => window.removeEventListener(VOICE_PREFERENCE_CHANGED_EVENT, handlePreferenceChange);
  }, []);

  // The user's mic is never auto-muted, in either direction — they can
  // always interrupt the assistant mid-answer, the same as talking over
  // a person. The only muting that ever happens is the assistant muting
  // *itself* on request (go_silent/resume_speaking, above, which lowers
  // its own output volume rather than touching the mic at all) or the
  // user choosing to mute themselves via the button below.

  // onError can fire with a transient, non-fatal warning even on a
  // connection that's otherwise fine (conversation.status genuinely says
  // "connected") — only treat it as a real, user-facing error state when
  // the session isn't actually connected, so a stale message can't hide
  // the status label or the mic controls on a healthy session.
  const hasBlockingError = Boolean(connectError) && conversation.status !== "connected";

  const orbState: OrbState =
    conversation.status === "connecting"
      ? "thinking"
      : conversation.status !== "connected"
        ? "idle"
        : conversation.mode === "speaking"
          ? "speaking"
          : "listening";

  const statusLabel = hasBlockingError
    ? "Tap to reconnect"
    : conversation.status === "connecting"
      ? "Connecting…"
      : conversation.status !== "connected"
        ? "Tap to connect"
        : silenced
          ? 'Silenced — say "unmute"'
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
    connectAmbientSession(isFormBuilderNew);
  }

  return (
    <div className="fixed right-5 bottom-5 z-40">
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-[#0b1f33] px-4 py-4 text-white shadow-lg">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleOrbClick}
              aria-label={statusLabel}
              className="cursor-pointer rounded-full"
            >
              <VoiceOrb state={orbState} size={64} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">{statusLabel}</TooltipContent>
        </Tooltip>

        <span className="max-w-[92px] text-center text-[10px] font-medium uppercase leading-tight tracking-wide text-white/40">
          {statusLabel}
        </span>

        {conversation.status === "connected" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => conversation.setMuted(!conversation.isMuted)}
                aria-label={conversation.isMuted ? "Unmute microphone" : "Mute microphone"}
                className={muteButtonClass(conversation.isMuted)}
              >
                {conversation.isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{conversation.isMuted ? "Unmute" : "Mute"}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function muteButtonClass(active: boolean): string {
  return active
    ? "flex size-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors"
    : "flex size-9 items-center justify-center rounded-full bg-teal text-teal-foreground transition-colors";
}
