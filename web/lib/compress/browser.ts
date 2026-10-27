/**
 * Browser compression engine (M2) — ported from site/app.html and extended to
 * chunked output (§8.3): decode with AudioContext → resample to mono 16 kHz
 * with OfflineAudioContext → re-encode WebM/Opus ~24 kbps with MediaRecorder →
 * ≤10-min chunks with a 2 s overlap. Pure decisions live in ./plan (tested in
 * Node); this module only drives the browser audio graph. Client only.
 */
import { BITRATE_BPS, MAX_DURATION_SEC, SAMPLE_RATE, chooseMimeType, planChunks } from "./plan";

export interface CompressedChunk {
  blob: Blob;
  offsetMs: number;
  durationMs: number;
}

export interface CompressResult {
  chunks: CompressedChunk[];
  container: string;
  durationMs: number;
}

export class CompressionError extends Error {
  constructor(
    public code: "too_long" | "no_encoder" | "decode_failed",
    message: string,
  ) {
    super(message);
    this.name = "CompressionError";
  }
}

export type CompressProgress = (pct: number, stage: "decoding" | "encoding") => void;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AudioContextCtor = new (options?: { sampleRate?: number }) => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Deterministic chunk path for the client upload (one blob per chunk). */
export function chunkPathname(episodeId: string, index: number, extension: string): string {
  return `episodes/${episodeId}/chunk-${String(index).padStart(4, "0")}.${extension}`;
}

/**
 * Decode + resample + chunk-encode a picked media file. Encoding runs in real
 * time per chunk (MediaRecorder records the playing buffer, as in
 * site/app.html); onProgress reports overall percent.
 */
export async function compressToChunks(
  file: File,
  onProgress: CompressProgress = () => {},
): Promise<CompressResult> {
  const Ctor = audioContextCtor();
  if (!Ctor) throw new CompressionError("no_encoder", "Web Audio is unavailable in this browser.");

  onProgress(4, "decoding");
  let decoded: AudioBuffer;
  const ctx = new Ctor();
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new CompressionError("decode_failed", "This audio could not be decoded.");
  } finally {
    await ctx.close().catch(() => {});
  }

  const durationSec = decoded.duration;
  if (durationSec > MAX_DURATION_SEC) {
    throw new CompressionError("too_long", "Episodes can be up to 2 hours.");
  }

  // Resample to 16 kHz mono offline (ported from site/app.html).
  const offline = new OfflineAudioContext(1, Math.ceil(durationSec * SAMPLE_RATE), SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const mono = await offline.startRendering();

  const mime = chooseMimeType((t) =>
    typeof MediaRecorder !== "undefined" ? MediaRecorder.isTypeSupported(t) : false,
  );
  if (!mime) {
    throw new CompressionError(
      "no_encoder",
      "This browser can't re-encode audio — paste the transcript instead.",
    );
  }

  const chunks = planChunks(durationSec);
  const out: CompressedChunk[] = [];
  for (const chunk of chunks) {
    const startSample = Math.floor(chunk.startSec * SAMPLE_RATE);
    const endSample = Math.min(Math.floor(chunk.endSec * SAMPLE_RATE), mono.length);
    const length = Math.max(1, endSample - startSample);
    const slice = new AudioBuffer({ length, sampleRate: SAMPLE_RATE, numberOfChannels: 1 });
    slice.copyToChannel(mono.getChannelData(0).subarray(startSample, endSample), 0);

    const parts: Blob[] = [];
    const recCtx = new Ctor();
    try {
      const dest = recCtx.createMediaStreamDestination();
      const play = recCtx.createBufferSource();
      play.buffer = slice;
      play.connect(dest);
      const rec = new MediaRecorder(dest.stream, {
        mimeType: mime.mimeType,
        audioBitsPerSecond: BITRATE_BPS,
      });
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) parts.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
      });
      rec.start(2000);
      play.start();
      const encodeSecs = slice.duration;
      const base = 25 + (chunk.index / chunks.length) * 70;
      const span = 70 / chunks.length;
      const tick = setInterval(() => {
        const done = Math.min(1, recCtx.currentTime / Math.max(encodeSecs, 0.001));
        onProgress(Math.round(base + done * span), "encoding");
      }, 500);
      await wait(encodeSecs * 1000 + 300);
      rec.stop();
      await stopped;
      clearInterval(tick);
    } finally {
      await recCtx.close().catch(() => {});
    }
    out.push({
      blob: new Blob(parts, { type: mime.container }),
      offsetMs: chunk.offsetMs,
      durationMs: Math.round(slice.duration * 1000),
    });
    onProgress(25 + ((chunk.index + 1) / chunks.length) * 70, "encoding");
  }
  onProgress(100, "encoding");
  return { chunks: out, container: mime.container, durationMs: Math.round(durationSec * 1000) };
}
