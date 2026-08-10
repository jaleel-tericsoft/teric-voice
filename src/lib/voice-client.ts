// Browser-side voice I/O: plays TTS audio (with barge-in support), records
// the user's answer with silence detection, and calls the
// transcribe/interpret API routes.

export interface Interpretation {
  value: string | boolean;
  confidence: number;
  needs_clarification: boolean;
  clarification_question: string | null;
  off_topic: boolean;
  off_topic_reply: string | null;
}

export interface ReviewCommand {
  intent: "submit" | "update_field" | "repeat_field" | "unclear";
  field_name: string | null;
  value: string | boolean | null;
  spoken_reply: string;
}

// Human speech carries most of its energy in this band (fundamental +
// lower formants). Environmental noise — fans, hums, traffic rumble, room
// hiss — is usually concentrated below or above it, or spread flat across
// the whole spectrum. Gating on energy concentration here, not just
// loudness, is what stops the mic from "hearing" the room.
const VOICE_BAND_LOW_HZ = 300;
const VOICE_BAND_HIGH_HZ = 3400;

export type VoiceSensitivity = "low" | "medium" | "high";

export interface SensitivityConfig {
  /** Mic level (0..1) above which we consider the user to be speaking. */
  speechThreshold: number;
  /** Share of frequency energy that must sit in the voice band to count at all. */
  voiceBandMinRatio: number;
  /** How long the signal must stay above threshold before it counts as
   * "the user started talking" — filters a brief background blip (a word
   * from another room, a cough, a door) from triggering a false capture. */
  minSpeechMs: number;
  /** Same idea, for interrupting the assistant mid-question (barge-in) —
   * deliberately a bit longer, since a false barge-in is more disruptive
   * than a false silence-detection trigger. */
  bargeInSustainMs: number;
}

// "Low" = least sensitive (best in noisy rooms — requires louder, longer,
// more voice-shaped signal). "High" = most sensitive (best for quiet rooms
// with a soft speaker, but more prone to picking up background sound).
const SENSITIVITY_PRESETS: Record<VoiceSensitivity, SensitivityConfig> = {
  low: { speechThreshold: 0.085, voiceBandMinRatio: 0.65, minSpeechMs: 320, bargeInSustainMs: 450 },
  medium: { speechThreshold: 0.055, voiceBandMinRatio: 0.55, minSpeechMs: 200, bargeInSustainMs: 320 },
  high: { speechThreshold: 0.03, voiceBandMinRatio: 0.42, minSpeechMs: 110, bargeInSustainMs: 200 },
};

export function getSensitivityConfig(level: VoiceSensitivity): SensitivityConfig {
  return SENSITIVITY_PRESETS[level];
}

/** Wraps a boolean check so it only reports true once the underlying
 * condition has held continuously for `sustainMs` — turns a single noisy
 * frame into a debounced, much more reliable signal. */
export function createSustainedGate(check: () => boolean, sustainMs: number) {
  let trueSince: number | null = null;
  return function poll(): boolean {
    if (check()) {
      if (trueSince === null) trueSince = Date.now();
      return Date.now() - trueSince >= sustainMs;
    }
    trueSince = null;
    return false;
  };
}

/** Reads {error, detail} off a failed route response and throws a message
 * specific enough to show directly in the UI (e.g. the real upstream
 * OpenAI/ElevenLabs error), instead of a generic "request failed". */
async function throwForFailedResponse(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null);
  const message = body?.detail || body?.error || fallback;
  throw new Error(message);
}

/**
 * Fetches TTS audio for `text` and plays it. If `shouldInterrupt` starts
 * returning true (the user has started talking over the assistant), playback
 * is stopped immediately instead of running to the end — this is what makes
 * the assistant "hear" a mid-question interruption rather than talking over
 * the user. `graceMs` ignores interruption checks for a brief window after
 * playback starts, so a stray noise right as audio begins doesn't cut it off.
 */
export async function speakText(
  text: string,
  opts: { signal?: AbortSignal; shouldInterrupt?: () => boolean; graceMs?: number } = {}
): Promise<{ interrupted: boolean }> {
  const { signal, shouldInterrupt, graceMs = 350 } = opts;

  const res = await fetch("/api/voice/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) await throwForFailedResponse(res, "Text-to-speech request failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  try {
    return await new Promise<{ interrupted: boolean }>((resolve, reject) => {
      let interrupted = false;
      let rafId = 0;
      let startedAt = 0;

      const stopPolling = () => {
        if (rafId) cancelAnimationFrame(rafId);
      };

      const poll = () => {
        if (shouldInterrupt && Date.now() - startedAt > graceMs && shouldInterrupt()) {
          interrupted = true;
          audio.pause();
          return;
        }
        rafId = requestAnimationFrame(poll);
      };

      audio.onended = () => {
        stopPolling();
        resolve({ interrupted: false });
      };
      audio.onerror = () => {
        stopPolling();
        reject(new Error("audio playback failed"));
      };
      audio.onpause = () => {
        if (interrupted) {
          stopPolling();
          resolve({ interrupted: true });
        }
      };
      if (signal) {
        signal.addEventListener("abort", () => {
          stopPolling();
          audio.pause();
          resolve({ interrupted: false });
        });
      }

      audio
        .play()
        .then(() => {
          startedAt = Date.now();
          if (shouldInterrupt) rafId = requestAnimationFrame(poll);
        })
        .catch(reject);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function transcribeAudio(blob: Blob, language = "en"): Promise<string> {
  const form = new FormData();
  form.append("audio", blob, "answer.webm");
  form.append("language", language);
  const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
  if (!res.ok) await throwForFailedResponse(res, "Transcription request failed");
  const data = await res.json();
  return data.transcript ?? "";
}

export async function interpretAnswer(params: {
  question: string;
  fieldType: string;
  options?: string[];
  transcript: string;
}): Promise<Interpretation> {
  const res = await fetch("/api/voice/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) await throwForFailedResponse(res, "Interpretation request failed");
  return res.json();
}

export async function interpretReviewCommand(params: {
  transcript: string;
  fields: Array<{
    fieldName: string;
    label: string;
    fieldType: string;
    options?: string[];
    currentValue: string | boolean | undefined;
  }>;
}): Promise<ReviewCommand> {
  const res = await fetch("/api/voice/review-command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) await throwForFailedResponse(res, "Review command request failed");
  return res.json();
}

/**
 * Holds one microphone permission grant for the whole voice session and
 * records answers with volume-based silence detection: once the user has
 * spoken, recording stops after `silenceMs` of quiet. If the user never
 * speaks at all within `maxDurationMs`, it stops anyway and returns
 * whatever was captured (transcribe() will report that as empty — the
 * caller's cue to repeat the question).
 */
interface CaptureOpts {
  maxDurationMs?: number;
  silenceMs?: number;
  speechThreshold?: number;
  voiceBandMinRatio?: number;
  minSpeechMs?: number;
}

interface ResolvedCaptureOpts {
  maxDurationMs: number;
  silenceMs: number;
  speechThreshold: number;
  voiceBandMinRatio: number;
  minSpeechMs: number;
}

export class MicSession {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType = "audio/webm";
  private rafId = 0;
  private captureOpts: ResolvedCaptureOpts = MicSession.resolveCaptureOpts({});

  // Tracked continuously for as long as a capture is running — including
  // while the assistant is still talking, since capture now starts at the
  // same moment the assistant begins speaking (see startCapture).
  private hasSpoken = false;
  private aboveThresholdSince: number | null = null;
  private silenceStartedAt: number | null = null;
  private capturedAt = 0;

  private static resolveCaptureOpts(opts: CaptureOpts): ResolvedCaptureOpts {
    const defaults = SENSITIVITY_PRESETS.medium;
    return {
      // Generous: this clock now starts when capture begins, which is as
      // early as the assistant's speech itself — it has to comfortably
      // outlast a long TTS question, not just the user's answer.
      maxDurationMs: opts.maxDurationMs ?? 20000,
      silenceMs: opts.silenceMs ?? 900, // shorter wait after the user stops = faster turnaround
      speechThreshold: opts.speechThreshold ?? defaults.speechThreshold,
      voiceBandMinRatio: opts.voiceBandMinRatio ?? defaults.voiceBandMinRatio,
      minSpeechMs: opts.minSpeechMs ?? defaults.minSpeechMs,
    };
  }

  async init(): Promise<void> {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // Critical for barge-in: without echo cancellation, the assistant's
        // own TTS audio bleeding into the mic (on speaker, not headphones)
        // can trigger a false "the user is talking" detection.
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024; // finer frequency resolution for the voice-band gate below
    source.connect(this.analyser);
  }

  stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.recorder && this.recorder.state === "recording") this.recorder.stop();
    this.recorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close().catch(() => {});
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
  }

  /** Current mic input level, 0..1, for driving a live waveform visual and
   * for speech/barge-in detection. Loud isn't enough to count as "level" —
   * the energy also has to be concentrated in the human-voice frequency
   * band, so a fan, hum, or room noise spike doesn't register as speech.
   * `voiceBandMinRatio` controls how strict that spectral gate is — pass
   * the current sensitivity preset's value (defaults to the "medium" preset
   * if omitted, for callers that don't care about sensitivity). */
  getLevel(voiceBandMinRatio = SENSITIVITY_PRESETS.medium.voiceBandMinRatio): number {
    if (!this.analyser || !this.audioContext) return 0;
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);

    const binWidth = this.audioContext.sampleRate / this.analyser.fftSize;
    const loBin = Math.max(1, Math.floor(VOICE_BAND_LOW_HZ / binWidth));
    const hiBin = Math.min(freqData.length - 1, Math.ceil(VOICE_BAND_HIGH_HZ / binWidth));

    let voiceEnergy = 0;
    let totalEnergy = 0;
    for (let i = 1; i < freqData.length; i++) {
      const e = (freqData[i] / 255) ** 2;
      totalEnergy += e;
      if (i >= loBin && i <= hiBin) voiceEnergy += e;
    }
    if (totalEnergy < 1e-6) return 0;

    const voiceRatio = voiceEnergy / totalEnergy;
    if (voiceRatio < voiceBandMinRatio) return 0; // noise-shaped, not voice-shaped

    const overallLevel = Math.sqrt(totalEnergy / freqData.length);
    return Math.min(1, overallLevel * 2.5);
  }

  /**
   * Starts recording immediately and begins tracking speech/silence from
   * this instant — call this as early as possible, ideally the moment the
   * assistant starts speaking (not after it finishes). That way, if the
   * user starts answering mid-sentence — very common in natural
   * conversation — those first words are already inside the recording
   * instead of being lost in the gap between "assistant stops talking" and
   * "we start listening" that used to clip them, forcing a repeat.
   *
   * Safe to call repeatedly: a capture already in progress is left alone.
   */
  async startCapture(opts: CaptureOpts = {}): Promise<void> {
    if (this.recorder && this.recorder.state === "recording") return;
    if (!this.stream) await this.init();

    this.captureOpts = MicSession.resolveCaptureOpts(opts);
    this.mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(this.stream!, { mimeType: this.mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    this.recorder = recorder;
    this.chunks = chunks;
    this.hasSpoken = false;
    this.aboveThresholdSince = null;
    this.silenceStartedAt = null;
    this.capturedAt = Date.now();

    recorder.start(100);
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    if (!this.recorder || this.recorder.state !== "recording") return;
    const { speechThreshold, voiceBandMinRatio, minSpeechMs, silenceMs, maxDurationMs } =
      this.captureOpts;
    const level = this.getLevel(voiceBandMinRatio);
    const now = Date.now();

    if (level > speechThreshold) {
      // hasSpoken only flips once the signal has stayed above threshold
      // continuously for minSpeechMs — a single loud frame (a cough, a word
      // from another room, the assistant's own voice bleeding through)
      // doesn't count as "the user started talking".
      if (!this.hasSpoken) {
        if (this.aboveThresholdSince === null) this.aboveThresholdSince = now;
        if (now - this.aboveThresholdSince >= minSpeechMs) this.hasSpoken = true;
      }
      this.silenceStartedAt = null;
    } else {
      this.aboveThresholdSince = null;
      if (this.hasSpoken) {
        if (this.silenceStartedAt === null) this.silenceStartedAt = now;
        if (now - this.silenceStartedAt >= silenceMs) {
          this.recorder.stop();
          return;
        }
      }
    }

    if (now - this.capturedAt >= maxDurationMs) {
      this.recorder.stop();
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  /** True once sustained speech has been detected on the capture currently
   * running — the single source of truth for "has the user started
   * answering", shared between silence-detection and barge-in decisions. */
  hasStartedSpeaking(): boolean {
    return this.hasSpoken;
  }

  /** Resolves once the current capture stops — naturally (silence after
   * speech), by timeout, or because stop() was called. Starts a capture
   * first if one isn't already running (equivalent to the old
   * recordUntilSilence behavior for callers that don't pre-start it). */
  async waitForCapture(opts: CaptureOpts = {}): Promise<Blob> {
    if (!this.recorder || this.recorder.state !== "recording") {
      await this.startCapture(opts);
    }
    const recorder = this.recorder!;
    if (recorder.state !== "recording") {
      // Stopped already between the check above and here — return whatever
      // was captured rather than hanging.
      return new Blob(this.chunks, { type: this.mimeType });
    }
    const chunks = this.chunks;
    const mimeType = this.mimeType;
    return new Promise<Blob>((resolve) => {
      recorder.addEventListener("stop", () => resolve(new Blob(chunks, { type: mimeType })), {
        once: true,
      });
    });
  }

  /** Convenience wrapper: start capturing now and wait for it to finish.
   * Prefer calling startCapture() earlier (e.g. when the assistant starts
   * speaking) and waitForCapture() afterwards when possible — starting and
   * waiting back-to-back like this still has the old gap where speech
   * before this call isn't captured. */
  async recordUntilSilence(opts: CaptureOpts = {}): Promise<Blob> {
    await this.startCapture(opts);
    return this.waitForCapture(opts);
  }
}
