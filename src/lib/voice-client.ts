// Browser-side voice I/O: plays TTS audio, records the user's answer with
// silence detection, and calls the transcribe/interpret API routes.

export interface Interpretation {
  value: string | boolean;
  confidence: number;
  needs_clarification: boolean;
  clarification_question: string | null;
}

/** Reads {error, detail} off a failed route response and throws a message
 * specific enough to show directly in the UI (e.g. the real upstream
 * OpenAI/Anthropic error), instead of a generic "request failed". */
async function throwForFailedResponse(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null);
  const message = body?.detail || body?.error || fallback;
  throw new Error(message);
}

/** Fetches TTS audio for `text` and plays it, resolving once playback ends. */
export async function speakText(text: string, signal?: AbortSignal): Promise<void> {
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
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("audio playback failed"));
      if (signal) {
        signal.addEventListener("abort", () => {
          audio.pause();
          resolve();
        });
      }
      audio.play().catch(reject);
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
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close().catch(() => {});
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
  }

  /** Current mic input level, 0..1, for driving a live waveform visual. */
  getLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (const v of data) {
      const norm = (v - 128) / 128;
      sumSquares += norm * norm;
    }
    return Math.min(1, Math.sqrt(sumSquares / data.length) * 4);
  }

  async recordUntilSilence(opts: {
    maxDurationMs?: number;
    silenceMs?: number;
    speechThreshold?: number;
  } = {}): Promise<Blob> {
    const { maxDurationMs = 12000, silenceMs = 1600, speechThreshold = 0.05 } = opts;
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
