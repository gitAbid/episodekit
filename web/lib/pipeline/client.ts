"use client";
// §7.5 client orchestration: the workspace page drives
// transcribe → analyze → generate×7 (parallel, max 4 concurrent) and persists
// nothing client-side; every step is idempotent server-side so a refresh or
// second tab resumes from DB state via GET /api/episodes/:id (polled 2 s).
import { useCallback, useEffect, useRef, useState } from "react";

export const ARTIFACT_ORDER = [
  "show_notes",
  "chapters",
  "summary",
  "titles",
  "blog",
  "newsletter",
  "social",
  "quotes",
] as const;
export type ArtifactKindName = (typeof ARTIFACT_ORDER)[number];

export interface ArtifactView {
  id: string;
  kind: ArtifactKindName;
  status: "pending" | "writing" | "ready" | "failed" | "fallback";
  content: Record<string, unknown> | null;
  previousContent: Record<string, unknown> | null;
  ready: boolean;
  regenCount: number;
  errorCode: string | null;
  updatedAt: string;
}

export interface EpisodeView {
  id: string;
  title: string | null;
  number: number | null;
  source: string;
  status: "uploading" | "queued" | "transcribing" | "writing" | "ready" | "failed";
  errorCode: string | null;
  durationMs: number | null;
  hasTimestamps: boolean;
  hasSpeakers: boolean;
}

/** Transcript line as shipped to the client (§7.1 segments minus bookkeeping). */
export interface TranscriptSegment {
  id: string;
  speaker: string | null;
  startMs: number | null;
  text: string;
}

export interface WorkspaceData {
  episode: EpisodeView;
  artifacts: ArtifactView[];
  analysis: { chapters: { startMs: number; title: string }[] | null; topics: string[] } | null;
  segments: TranscriptSegment[];
  /** Free plan appends the footer line on export (M7/M10). */
  freePlan: boolean;
}

async function postJson(url: string, body: unknown = {}): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

/** Refresh episode + artifacts from the server (single source of truth). */
export async function fetchWorkspace(episodeId: string): Promise<WorkspaceData | null> {
  const res = await fetch(`/api/episodes/${episodeId}/workspace`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as WorkspaceData;
}

/**
 * Drive the pipeline for an episode. Each step checks server state first
 * (idempotent), so calling this on every mount is safe. Generation runs
 * with max 4 concurrent calls (§7.5).
 */
export async function drivePipeline(episodeId: string, data: WorkspaceData): Promise<void> {
  const { episode, artifacts, analysis } = data;
  if (episode.status === "uploading" || episode.status === "transcribing") return; // transcribe is driven by the intake page / resume button
  // No transcript yet (e.g. the brief queued step before transcription starts):
  // nothing to analyze or write from. useWorkspace drives again once it lands.
  if (data.segments.length === 0) return;
  if (analysis === null && data.segments.length > 0) {
    await postJson(`/api/episodes/${episodeId}/analyze`);
  }
  const pending = ARTIFACT_ORDER.filter((kind) => {
    const a = artifacts.find((x) => x.kind === kind);
    return !a || a.status === "failed" || (a.status === "fallback" && a.content === null);
  });
  let running = 0;
  const queue = [...pending];
  await new Promise<void>((resolve) => {
    const next = (): void => {
      if (queue.length === 0 && running === 0) return resolve();
      while (running < 4 && queue.length > 0) {
        const kind = queue.shift();
        if (!kind) break;
        running += 1;
        void postJson(`/api/episodes/${episodeId}/artifacts/${kind}/generate`)
          .catch(() => undefined)
          .finally(() => {
            running -= 1;
            next();
          });
      }
    };
    next();
  });
}

export interface UseWorkspace {
  data: WorkspaceData | null;
  error: string | null;
  refresh: () => Promise<void>;
  regenerate: (kind: ArtifactKindName, instruction?: string) => Promise<void>;
  undo: (artifactId: string) => Promise<void>;
  saveContent: (artifactId: string, content: Record<string, unknown>) => Promise<void>;
  setReady: (artifactId: string, ready: boolean) => Promise<void>;
}

export function useWorkspace(episodeId: string, initial: WorkspaceData): UseWorkspace {
  const [data, setData] = useState<WorkspaceData | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const drovenWithTranscript = useRef(initial.segments.length > 0);

  const refresh = useCallback(async () => {
    const fresh = await fetchWorkspace(episodeId);
    if (fresh) setData(fresh);
  }, [episodeId]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        await drivePipeline(episodeId, initial);
        await refresh();
      } catch (err) {
        setError(String(err));
      }
    })();
  }, [episodeId, initial, refresh]);

  // Arrived from intake before the transcript existed (upload still
  // transcribing): drive the pipeline once the polled data has segments.
  useEffect(() => {
    if (!data || drovenWithTranscript.current || data.segments.length === 0) return;
    drovenWithTranscript.current = true;
    void (async () => {
      try {
        await drivePipeline(episodeId, data);
        await refresh();
      } catch (err) {
        setError(String(err));
      }
    })();
  }, [data, episodeId, refresh]);

  // Poll every 2 s while the episode is not terminal (§7.5).
  useEffect(() => {
    if (!data || data.episode.status === "ready" || data.episode.status === "failed") return;
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [data, refresh]);

  const regenerate = useCallback(
    async (kind: ArtifactKindName, instruction?: string) => {
      await postJson(`/api/episodes/${episodeId}/artifacts/${kind}/generate`, instruction ? { instruction } : {});
      await refresh();
    },
    [episodeId, refresh],
  );

  const undo = useCallback(
    async (artifactId: string) => {
      await fetch(`/api/artifacts/${artifactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: true }),
      });
      await refresh();
    },
    [refresh],
  );

  const saveContent = useCallback(
    async (artifactId: string, content: Record<string, unknown>) => {
      await fetch(`/api/artifacts/${artifactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setData((d) =>
        d
          ? { ...d, artifacts: d.artifacts.map((a) => (a.id === artifactId ? { ...a, content } : a)) }
          : d,
      );
    },
    [],
  );

  const setReady = useCallback(
    async (artifactId: string, ready: boolean) => {
      // Optimistic: the checkbox is controlled; flip it before the round-trip.
      setData((d) =>
        d ? { ...d, artifacts: d.artifacts.map((a) => (a.id === artifactId ? { ...a, ready } : a)) } : d,
      );
      await fetch(`/api/artifacts/${artifactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ready }),
      });
    },
    [],
  );

  return { data, error, refresh, regenerate, undo, saveContent, setReady };
}
