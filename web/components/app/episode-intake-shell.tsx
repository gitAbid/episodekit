"use client";

/**
 * New-episode intake (M2, MK-4): Upload audio / Paste transcript tabs, browser
 * compression + chunked Blob upload with progress, format chip for pasted
 * transcripts (U5), optional title/number/guests, sample episode (free, no
 * quota), and the resumable status read path (?id= → server status, U4).
 * WP-01 components are not merged yet — plain Tailwind per §5.2 tokens.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { checkUpload } from "@/lib/episodes/audio";
import { chunkPathname, compressToChunks, type CompressedChunk } from "@/lib/compress/browser";
import { detectFormat } from "@/lib/transcripts";
import type { SerializedEpisode } from "@/lib/episodes/service";

const SAMPLE_TEXT_URL = "/samples/demo-episode.txt";

const STATUS_LABELS: Record<SerializedEpisode["status"], string> = {
  uploading: "Uploading",
  queued: "Queued",
  transcribing: "Transcribing",
  writing: "Writing",
  ready: "Ready",
  failed: "Failed",
};

function errorCodeCopy(code: string | null): string | null {
  switch (code) {
    case "unsupported_language":
      return "EpisodeKit works with English episodes for now. This one wasn't charged.";
    case "no_speech":
      return "We couldn't hear any speech in this file. Check the audio and try again.";
    case "too_long":
      return "Episodes can be up to 2 hours on your plan.";
    case "quota_exceeded":
      return "You've used your episodes for this month. Upgrade for more.";
    default:
      return "Something went wrong on our side. Try again — it won't use another episode.";
  }
}

const formatDuration = (ms: number) => {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export function EpisodeIntakeShell() {
  // ?id=<episodeId> → resumable status view (U4).
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("id") ?? undefined;
  const [tab, setTab] = useState<"upload" | "paste">("upload");
  const [episodeId, setEpisodeId] = useState<string | null>(resumeId ?? null);
  const [episode, setEpisode] = useState<SerializedEpisode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Upload tab state
  const [fileInfo, setFileInfo] = useState<{ name: string; durationMs: number; sizeMB: number } | null>(null);
  const [phase, setPhase] = useState<"idle" | "compressing" | "ready" | "creating" | "uploading">("idle");
  const [progress, setProgress] = useState(0);
  const chunksRef = useRef<{ chunks: CompressedChunk[]; extension: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Paste tab state
  const [pasteText, setPasteText] = useState("");
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const detected = pasteText.trim() ? detectFormat(pasteText) : null;

  // Details (MK-4)
  const [title, setTitle] = useState("");
  const [number_, setNumber_] = useState("");
  const [guests, setGuests] = useState<string[]>([]);

  // U4: resumable status — poll the server every 2 s until a terminal state.
  useEffect(() => {
    if (!episodeId) return;
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const poll = async () => {
      const res = await fetch(`/api/episodes/${episodeId}`);
      if (!res.ok) {
        if (res.status !== 503 && alive) {
          setError("Couldn't load this episode. Refresh to try again.");
        }
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { episode?: SerializedEpisode };
      if (alive && json.episode) {
        setEpisode(json.episode);
        if (json.episode.status === "ready" || json.episode.status === "failed") {
          if (timer) clearInterval(timer);
        }
      }
    };
    void poll();
    timer = setInterval(() => void poll(), 2000);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [episodeId]);

  const prepareFile = useCallback(async (file: File) => {
    setError(null);
    const check = checkUpload(file.name, file.size);
    if (!check.ok) {
      setError(check.copy);
      return;
    }
    setFileInfo({ name: file.name, durationMs: 0, sizeMB: file.size / 1e6 });
    setPhase("compressing");
    setProgress(0);
    try {
      const result = await compressToChunks(file, (pct) => setProgress(pct));
      chunksRef.current = {
        chunks: result.chunks,
        extension: result.chunks[0]?.blob.type.split("/")[1]?.split(";")[0] ?? "webm",
      };
      const totalMB = result.chunks.reduce((sum, c) => sum + c.blob.size, 0) / 1e6;
      setFileInfo({ name: file.name, durationMs: result.durationMs, sizeMB: totalMB });
      setPhase("ready");
    } catch (e) {
      const code = e instanceof Error && "code" in e ? String((e as { code: unknown }).code) : "decode_failed";
      setError(
        code === "too_long"
          ? "Episodes can be up to 2 hours on your plan."
          : "Couldn't process that audio file. Try another format, or paste the transcript.",
      );
      setPhase("idle");
      setFileInfo(null);
    }
  }, []);

  const details = useCallback(
    () => ({
      title: title.trim() || undefined,
      number: number_ ? Number(number_) : undefined,
      guests: guests.map((g) => g.trim()).filter(Boolean),
    }),
    [title, number_, guests],
  );

  const createAndUpload = useCallback(async () => {
    const prepared = chunksRef.current;
    if (!prepared?.chunks.length) return;
    setBusy(true);
    setError(null);
    setPhase("creating");
    try {
      const created = await postJson("/api/episodes", { source: "upload", ...details() });
      if (!created.ok || !created.json.id) {
        throw new Error(String(created.json.error ?? "Couldn't create the episode. Try again."));
      }
      const id = String(created.json.id);
      window.history.replaceState(null, "", `/app/episodes/new?id=${id}`);
      setEpisodeId(id);
      setEpisode({
        id,
        title: title.trim() || null,
        number: number_ ? Number(number_) : null,
        source: "upload",
        status: "uploading",
        errorCode: null,
        durationMs: null,
        hasTimestamps: false,
        hasSpeakers: false,
        countsQuota: true,
      });

      setPhase("uploading");
      const manifest: { path: string; offsetMs: number }[] = [];
      for (let i = 0; i < prepared.chunks.length; i += 1) {
        const chunk = prepared.chunks[i];
        const pathname = chunkPathname(id, i, prepared.extension);
        const uploaded = await upload(pathname, chunk.blob, {
          access: "private",
          handleUploadUrl: "/api/uploads/token",
          onUploadProgress: (p) => {
            const chunkBase = (i / prepared.chunks.length) * 100;
            setProgress(Math.round(chunkBase + (p.percentage / 100) * (100 / prepared.chunks.length)));
          },
        });
        manifest.push({ path: uploaded.pathname, offsetMs: chunk.offsetMs });
      }

      setProgress(100);
      const started = await postJson(`/api/episodes/${id}/transcribe`, { chunks: manifest });
      if (!started.ok) {
        throw new Error(String(started.json.error ?? "Transcription didn't start. Try again."));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
      setPhase("ready");
    } finally {
      setBusy(false);
    }
  }, [details, number_, title]);

  const createPaste = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const source = sampleLoaded && pasteText.trim() ? "sample" : "paste";
      const created = await postJson("/api/episodes", { source, transcriptText: pasteText, ...details() });
      if (!created.ok || !created.json.id) {
        throw new Error(String(created.json.error ?? "Couldn't create the episode. Try again."));
      }
      const id = String(created.json.id);
      window.history.replaceState(null, "", `/app/episodes/new?id=${id}`);
      setEpisodeId(id);
      setEpisode({
        id,
        title: title.trim() || null,
        number: number_ ? Number(number_) : null,
        source: source as SerializedEpisode["source"],
        status: "queued",
        errorCode: null,
        durationMs: null,
        hasTimestamps: detected?.hasTimestamps ?? false,
        hasSpeakers: detected?.hasSpeakers ?? false,
        countsQuota: source !== "sample",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the episode. Try again.");
    } finally {
      setBusy(false);
    }
  }, [pasteText, sampleLoaded, details, detected, number_, title]);

  const loadSample = useCallback(async () => {
    setError(null);
    try {
      const text = await (await fetch(SAMPLE_TEXT_URL)).text();
      setPasteText(text);
      setSampleLoaded(true);
      setTab("paste");
    } catch {
      setError("Couldn't load the sample. Try again.");
    }
  }, []);

  // --- resume view (U4): show server status instead of the form ---
  if (episode) {
    const failed = episode.status === "failed";
    return (
      <div className="flex flex-col gap-4" data-testid="status-view">
        <div className="flex items-center gap-2" data-testid="status-pill" aria-live="polite">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
              failed
                ? "border-red-200 bg-red-50 text-red-800"
                : episode.status === "ready"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            {STATUS_LABELS[episode.status]}
          </span>
          {episode.title ? <span className="text-sm text-neutral-600">{episode.title}</span> : null}
        </div>
        {failed && episode.errorCode ? (
          <p className="text-sm text-neutral-700" data-testid="status-error">
            {errorCodeCopy(episode.errorCode)}
          </p>
        ) : (
          <p className="text-sm text-neutral-600">{"You can leave this page — we'll email you when it's ready."}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={loadSample}
        data-testid="sample-button"
        className="-mt-2 self-start text-sm font-medium text-blue-700 hover:underline"
      >
        Try with a sample episode
      </button>

      <div className="flex gap-4 border-b border-neutral-200 text-sm" role="tablist" aria-label="Input type">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "upload"}
          data-testid="tab-upload"
          onClick={() => setTab("upload")}
          className={`-mb-px border-b-2 pb-2 ${tab === "upload" ? "border-blue-700 font-medium" : "border-transparent text-neutral-500"}`}
        >
          Upload audio
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "paste"}
          data-testid="tab-paste"
          onClick={() => setTab("paste")}
          className={`-mb-px border-b-2 pb-2 ${tab === "paste" ? "border-blue-700 font-medium" : "border-transparent text-neutral-500"}`}
        >
          Paste transcript
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="intake-error">
          {error}
        </p>
      ) : null}

      {tab === "upload" ? (
        <div className="flex flex-col gap-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose an audio file"
            data-testid="drop-zone"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) void prepareFile(file);
            }}
            className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center ${
              dragOver ? "border-blue-700 bg-blue-50" : "border-neutral-400"
            }`}
          >
            <span className="text-sm font-medium">Drop audio or video, or browse</span>
            <span className="text-xs text-neutral-500">
              MP3, M4A, WAV, AAC, OGG, MP4, MOV · up to 2 hours
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".mp3,.m4a,.wav,.aac,.ogg,.webm,.mp4,.mov,audio/*,video/mp4,video/quicktime"
            data-testid="file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void prepareFile(file);
            }}
          />
          {phase !== "idle" && fileInfo ? (
            <div className="flex flex-col gap-1" data-testid="upload-progress">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{fileInfo.name}</span>
                <span className="text-neutral-500">
                  {phase === "compressing" ? "Compressing" : phase === "uploading" ? "Uploading" : "Ready"}{" "}
                  {progress}%
                  {fileInfo.durationMs ? ` · ${formatDuration(fileInfo.durationMs)}` : ""}
                  {phase !== "compressing" ? ` · ${fileInfo.sizeMB.toFixed(1)} MB` : ""}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-neutral-200">
                <div className="h-full bg-blue-700 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            data-testid="paste-textarea"
            aria-label="Paste your transcript"
            placeholder="Paste your transcript here…"
            rows={10}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="w-full rounded-md border border-neutral-300 p-3 font-mono text-sm focus:outline-2 focus:outline-blue-700"
          />
          {detected ? (
            <p className="text-xs text-neutral-600" data-testid="format-chip">
              {detected.chip}
            </p>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium text-neutral-500">Details (all optional)</span>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Episode title
            <input
              data-testid="episode-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-64 rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Episode #
            <input
              data-testid="episode-number"
              value={number_}
              inputMode="numeric"
              onChange={(e) => setNumber_(e.target.value.replace(/[^\d]/g, ""))}
              className="w-24 rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm">Guests</span>
          {guests.map((guest, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                data-testid={`guest-${i}`}
                aria-label={`Guest ${i + 1}`}
                value={guest}
                onChange={(e) => setGuests(guests.map((g, j) => (j === i ? e.target.value : g)))}
                className="w-56 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                aria-label={`Remove guest ${i + 1}`}
                onClick={() => setGuests(guests.filter((_, j) => j !== i))}
                className="text-sm text-neutral-500 hover:text-neutral-800"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            data-testid="add-guest"
            onClick={() => setGuests([...guests, ""])}
            className="self-start text-sm font-medium text-blue-700 hover:underline"
          >
            + add guest
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {tab === "upload" ? (
          <button
            type="button"
            data-testid="create-button"
            disabled={phase !== "ready" || busy}
            onClick={() => void createAndUpload()}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:bg-neutral-200 disabled:text-neutral-500"
          >
            {phase === "creating" || phase === "uploading" ? "Working…" : "Create package"}
          </button>
        ) : (
          <button
            type="button"
            data-testid="create-button"
            disabled={!pasteText.trim() || busy}
            onClick={() => void createPaste()}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:bg-neutral-200 disabled:text-neutral-500"
          >
            {busy ? "Working…" : "Create package"}
          </button>
        )}
        {tab === "paste" && !sampleLoaded ? <span className="text-xs text-neutral-500">Uses 1 of your episodes this month.</span> : null}
        {tab === "paste" && sampleLoaded ? <span className="text-xs text-neutral-500">{"The sample is free — it doesn't use an episode."}</span> : null}
      </div>
    </div>
  );
}
