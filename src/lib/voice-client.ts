// Browser-side voice I/O: plays TTS audio (with barge-in support), records
// the user's answer with silence detection, and calls the
// transcribe/interpret API routes.

export interface Interpretation {
  value: string | boolean;
  confidence: number;
  needs_clarification: boolean;
  clarification_question: string | null;
  off_topic: boolean;
}

export interface ReviewCommand {
  intent: "submit" | "update_field" | "unclear";
  field_name: string | null;
  value: string | boolean | null;
  spoken_reply: string;
}

/** Shared mic-level threshold (0..1) above which we consider the user to be
 * actively speaking — used both to detect the start of an answer and to
 * detect barge-in while the assistant is still talking. Paired with the
 * spectral gate in MicSession.getLevel(), so this only needs to separate
 * quiet vs. loud human speech, not speech vs. noise. */
export const SPEECH_LEVEL_THRESHOLD = 0.035;

// Human speech carries most of its energy in this band (fundamental +
// lower formants). Environmental noise — fans, hums, traffic rumble, room
// hiss — is usually concentrated below or above it, or spread flat across
// the whole spectrum. Gating on energy concentration here, not just
// loudness, is what stops the mic from "hearing" the room.
const VOICE_BAND_LOW_HZ = 300;
const VOICE_BAND_HIGH_HZ = 3400;
const VOICE_BAND_MIN_RATIO = 0.45; // share of total energy that must sit in-band

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
export class MicSession {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

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
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close().catch(() => {});
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
  }

  /** Current mic input level, 0..1, for driving a live waveform visual and
   * for speech/barge-in detection. Loud isn't enough to count as "level" —
   * the energy also has to be concentrated in the human-voice frequency
   * band, so a fan, hum, or room noise spike doesn't register as speech. */
  getLevel(): number {
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
    if (voiceRatio < VOICE_BAND_MIN_RATIO) return 0; // noise-shaped, not voice-shaped

    const overallLevel = Math.sqrt(totalEnergy / freqData.length);
    return Math.min(1, overallLevel * 2.5);
  }

  async recordUntilSilence(opts: {
    maxDurationMs?: number;
    silenceMs?: number;
    speechThreshold?: number;
  } = {}): Promise<Blob> {
    const {
      maxDurationMs = 12000,
      silenceMs = 900, // shorter wait after the user stops = faster turnaround
      speechThreshold = SPEECH_LEVEL_THRESHOLD,
    } = opts;
    if (!this.stream) await this.init();

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(this.stream!, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    return new Promise<Blob>((resolve) => {
      let hasSpoken = false;
      let silenceStartedAt: number | null = null;
      const startedAt = Date.now();

      recorder.start(100);

      const tick = () => {
        if (recorder.state !== "recording") return;

        const level = this.getLevel();
        const now = Date.now();

        if (level > speechThreshold) {
          hasSpoken = true;
          silenceStartedAt = null;
        } else if (hasSpoken) {
          if (silenceStartedAt === null) silenceStartedAt = now;
          if (now - silenceStartedAt >= silenceMs) {
            recorder.stop();
            return;
          }
        }

        if (now - startedAt >= maxDurationMs) {
          recorder.stop();
          return;
        }

        requestAnimationFrame(tick);
      };

      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };

      requestAnimationFrame(tick);
    });
  }
}
