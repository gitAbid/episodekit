"use client";
// MK-6 episode workspace. One episode = one screen: artifact nav (left),
// editor (center), quotes + transcript (right); mobile uses chip row + bottom
// tabs (§5.5). Processing (MK-5) renders in the same URL until ready.
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ARTIFACT_ORDER,
  useWorkspace,
  type ArtifactKindName,
  type ArtifactView,
} from "@/lib/pipeline/client";
import { ArtifactEditor } from "./editors";
import { QuotesPanel } from "./quotes-panel";
import { TranscriptPanel } from "./transcript-panel";
import { CopyMenu, RegenerateMenu, DownloadAllButton } from "./toolbar";
import { StatusPill } from "@/components/app/status-pill";
import { ArtifactFeedback } from "@/components/app/artifact-feedback";
import { toast as sonnerToast } from "sonner";

const KIND_LABELS: Record<ArtifactKindName, string> = {
  show_notes: "Show notes",
  chapters: "Chapters",
  summary: "Summary",
  titles: "Titles",
  blog: "Blog post",
  newsletter: "Newsletter",
  social: "Social posts",
  quotes: "Quotes",
};

function mmss(ms: number | null): string {
  if (ms === null) return "--:--";
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function WorkspaceView({ initial, freePlan, showName }: { initial: import("@/lib/pipeline/client").WorkspaceData; freePlan: boolean; showName: string }) {
  const ws = useWorkspace(initial.episode.id, initial);
  const data = ws.data;
  const [active, setActive] = useState<ArtifactKindName>("show_notes");
  const [mobileTab, setMobileTab] = useState<"write" | "quotes" | "transcript">("write");


  const byKind = useMemo(() => {
    const m = new Map<ArtifactKindName, ArtifactView>();
    for (const k of ARTIFACT_ORDER) {
      const found = data?.artifacts.find((a) => a.kind === k);
      if (found) m.set(k, found);
    }
    return m;
  }, [data]);

  if (!data) {
    return (
      <div data-workspace className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground" aria-live="polite">
        Loading your workspace…
      </div>
    );
  }

  const episode = data.episode;
  // M8's "Ready x/7" counts the seven M4 artifacts; quotes is its own panel.
  const readySeven = ARTIFACT_ORDER.filter((k) => {
    if (k === "quotes") return false;
    const a = data.artifacts.find((x) => x.kind === k);
    return Boolean(a && (a.status === "ready" || a.status === "fallback"));
  }).length;
  const activeArtifact = active === "quotes" ? byKind.get("quotes") : byKind.get(active);
  const chapters = byKind.get("chapters")?.content as { items?: { startMs: number; title: string }[] } | null;
  const chapterItems = chapters?.items ?? data.analysis?.chapters ?? [];

  const onRegenerate = async (instruction?: string) => {
    await ws.regenerate(active, instruction);
    const a = byKind.get(active);
    sonnerToast("Regenerated", {
      action: { label: "Undo", onClick: () => void (a && ws.undo(a.id)) },
    });
  };

  return (
    <div data-workspace className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 md:px-6">
        <Link href="/app/episodes" className="text-sm text-muted-foreground hover:text-foreground">
          ← Episodes
        </Link>
        <h1 className="flex-1 truncate text-base font-semibold md:text-lg">
          {episode.title ?? "Untitled"}
        </h1>
        <StatusPill
          status={episode.status === "uploading" ? "queued" : episode.status}
          label={episode.status === "uploading" ? "Uploading" : undefined}
        />
        <span className="text-sm text-muted-foreground" data-testid="ready-count">{readySeven}/7 ready</span>
        <DownloadAllButton
          artifacts={Object.fromEntries(data.artifacts.map((a) => [a.kind, a.content ?? {}]))}
          segments={data.segments}
          showName={showName}
          episodeTitle={episode.title}
          freePlan={freePlan}
          chapters={chapterItems}
        />
      </header>

      <p className="sr-only" aria-live="polite">
        {episode.status === "ready" ? "Package ready." : `Working — ${episode.status}.`}
      </p>

      {/* Mobile: chip row (§5.5) */}
      <nav className="flex gap-2 overflow-x-auto border-b px-4 py-2 md:hidden" aria-label="Artifacts">
        {ARTIFACT_ORDER.map((k) => {
          const a = byKind.get(k);
          const done = a && (a.status === "ready" || a.status === "fallback");
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setActive(k);
                setMobileTab("write");
              }}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${active === k ? "border-[var(--accent)] bg-[var(--accent-soft)]" : ""}`}
            >
              {done ? "✓ " : ""}
              {KIND_LABELS[k]}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-1 min-h-0">
        {/* Left nav (MK-6, 220px) */}
        <nav className="hidden w-[220px] shrink-0 flex-col gap-1 border-r p-3 md:flex" aria-label="Artifacts">
          {ARTIFACT_ORDER.map((k) => {
            const a = byKind.get(k);
            const done = Boolean(a && (a.status === "ready" || a.status === "fallback") && a.ready);
            return (
              <button
                key={k}
                type="button"
                onClick={() => setActive(k)}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${active === k ? "bg-[var(--surface-2)] font-medium" : "hover:bg-[var(--surface-2)]"}`}
              >
                <span>{KIND_LABELS[k]}</span>
                <span aria-hidden>{done ? "✓" : a?.status === "writing" ? "…" : ""}</span>
              </button>
            );
          })}
          <div className="my-2 border-t" />
          <div className="px-3 py-2 text-xs text-muted-foreground">
            {mmss(episode.durationMs)} · {episode.source}
          </div>
        </nav>

        {/* Center: editor */}
        <section className={`${mobileTab === "write" ? "flex" : "hidden"} min-w-0 flex-1 flex-col overflow-y-auto p-4 md:flex md:p-6`}>
          {active !== "quotes" && activeArtifact && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="flex-1 text-sm font-semibold">{KIND_LABELS[active]}</h2>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={activeArtifact.ready}
                    onChange={(e) => void ws.setReady(activeArtifact.id, e.target.checked)}
                    data-testid="ready-flag"
                  />
                  Ready
                </label>
                <ArtifactFeedback kind={active} episodeId={episode.id} />
                <RegenerateMenu onRegenerate={onRegenerate} disabled={activeArtifact.status === "writing"} />
                <CopyMenu
                  kind={active}
                  artifact={activeArtifact}
                  segments={data.segments}
                  showName={showName}
                  episodeTitle={episode.title}
                  freePlan={freePlan}
                  chapters={chapterItems}
                />
              </div>
              {activeArtifact.status === "fallback" && (
                <p className="mb-4 rounded-md border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2 text-sm" data-testid="fallback-banner">
                  Basic version — our AI writer was unavailable. Regenerate when you&apos;re ready.
                </p>
              )}
              {activeArtifact.status === "failed" && (
                <div className="mb-4 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-sm" data-testid="failed-card">
                  <p>Something went wrong on our side. Try again — it won&apos;t use another episode.</p>
                  <button type="button" onClick={() => void onRegenerate()} className="mt-2 rounded-md border px-3 py-1.5">
                    Try again
                  </button>
                </div>
              )}
              {(activeArtifact.status === "writing" || activeArtifact.status === "pending") && (
                <div className="space-y-2" data-testid="artifact-skeleton" aria-hidden>
                  <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-2)]" />
                  <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-2)]" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--surface-2)]" />
                </div>
              )}
              {(activeArtifact.status === "ready" || activeArtifact.status === "fallback") && activeArtifact.content && (
                <ArtifactEditor
                  key={activeArtifact.updatedAt}
                  kind={active}
                  artifact={activeArtifact}
                  segments={data.segments}
                  chapters={chapterItems}
                  onSave={(content) => ws.saveContent(activeArtifact.id, content)}
                />
              )}
            </>
          )}
          {episode.status === "writing" && (
            <p className="mt-6 text-sm text-muted-foreground" data-testid="leave-page-note">
              You can leave this page — we&apos;ll email you when it&apos;s ready.
            </p>
          )}
        </section>

        {/* Right: quotes + transcript (MK-6, 340px) */}
        <aside className={`${mobileTab === "write" ? "hidden" : "flex"} w-full shrink-0 flex-col overflow-y-auto border-l md:flex md:w-[340px]`} data-testid="right-panel">
          <QuotesPanel artifacts={data.artifacts} segments={data.segments} episodeId={episode.id} hasTimestamps={episode.hasTimestamps} />
          <div className="border-t" />
          <TranscriptPanel segments={data.segments} />
        </aside>
      </div>

      {/* Mobile bottom tabs (§5.5) */}
      <nav className="flex border-t md:hidden" aria-label="Sections">
        {(["write", "quotes", "transcript"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMobileTab(t)}
            className={`flex-1 py-3 text-sm capitalize ${mobileTab === t ? "border-t-2 border-[var(--accent)] font-medium" : ""}`}
          >
            {t === "write" ? "Write" : t === "quotes" ? "Quotes" : "Transcript"}
          </button>
        ))}
      </nav>
    </div>
  );
}
