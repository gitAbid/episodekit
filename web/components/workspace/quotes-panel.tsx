"use client";
// MK-7 quotes panel: 5 verified pull-quotes rendered from transcript offsets
// (§7.3 — source text only), VerifiedBadge (`Verified · mm:ss` or `Verified in
// transcript`), badge click → popover with the surrounding sentence + play
// from timestamp; Remove / Swap (M5).
import { useState } from "react";
import type { ArtifactView } from "@/lib/pipeline/client";
import { VerifiedBadge } from "@/components/app/verified-badge";
import type { TranscriptSegment } from "@/lib/pipeline/client";

interface QuoteRefView {
  segmentId: string;
  start: number;
  end: number;
  endSegmentId?: string;
}

function mmss(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function quoteText(ref: QuoteRefView, segments: TranscriptSegment[]): { text: string; speaker: string | null; startMs: number | null; around: string } {
  const seg = segments.find((s) => s.id === ref.segmentId);
  if (!seg) return { text: "", speaker: null, startMs: null, around: "" };
  const end = ref.endSegmentId ? (segments.find((s) => s.id === ref.endSegmentId)?.text.length ?? seg.text.length) : ref.end;
  const text = ref.endSegmentId
    ? `${seg.text.slice(ref.start)} ${segments.find((s) => s.id === ref.endSegmentId)?.text.slice(0, ref.end) ?? ""}`.trim()
    : seg.text.slice(ref.start, end);
  // Surrounding sentence context for the popover (§7.3 / MK-7).
  const before = seg.text.slice(Math.max(0, ref.start - 80), ref.start);
  const afterSource = ref.endSegmentId ? segments.find((s) => s.id === ref.endSegmentId)?.text ?? "" : seg.text;
  const after = afterSource.slice(Math.min(afterSource.length, end), Math.min(afterSource.length, end + 80));
  void end;
  return { text, speaker: seg.speaker, startMs: seg.startMs, around: `${before}**${text}**${after}`.trim() };
}

export function QuotesPanel({
  artifacts,
  segments,
  episodeId,
  hasTimestamps,
}: {
  artifacts: ArtifactView[];
  segments: TranscriptSegment[];
  episodeId: string;
  hasTimestamps: boolean;
}) {
  const quotesArtifact = artifacts.find((a) => a.kind === "quotes");
  const [items, setItems] = useState<QuoteRefView[] | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [audioNote, setAudioNote] = useState<string | null>(null);

  const current = items ?? ((quotesArtifact?.content?.items as QuoteRefView[] | undefined) ?? []);
  const removed = new Set<number>();

  const remove = (i: number) => {
    removed.add(i);
    setItems(current.filter((_, j) => j !== i));
  };
  void removed;

  const swap = (i: number) => {
    // Swap = pick another candidate: reuse analysis candidates not already shown.
    const pool = (quotesArtifact?.content?.candidates as QuoteRefView[] | undefined) ?? [];
    const used = new Set(current.map((q) => `${q.segmentId}:${q.start}`));
    const next = pool.find((c) => !used.has(`${c.segmentId}:${c.start}`));
    if (next) setItems(current.map((q, j) => (j === i ? next : q)));
  };

  const playFrom = async (startMs: number | null) => {
    if (startMs === null) return;
    const res = await fetch(`/api/audio/${episodeId}`).catch(() => null);
    if (!res || !res.ok) {
      setAudioNote("Audio isn't available in this preview.");
      return;
    }
    const { url } = (await res.json()) as { url?: string };
    if (!url) {
      setAudioNote("Audio isn't available in this preview.");
      return;
    }
    const audio = new Audio(url);
    audio.currentTime = startMs / 1000;
    await audio.play().catch(() => setAudioNote("Audio isn't available in this preview."));
  };

  if (current.length === 0) {
    return (
      <section className="p-4" aria-label="Quotes">
        <h2 className="mb-2 text-sm font-semibold">Quotes</h2>
        <p className="text-sm text-muted-foreground" data-testid="quotes-empty">Verified quotes appear here.</p>
      </section>
    );
  }

  return (
    <section className="p-4" aria-label="Quotes">
      <h2 className="mb-3 text-sm font-semibold">Quotes</h2>
      <ul className="flex flex-col gap-3">
        {current.map((ref, i) => {
          const q = quoteText(ref, segments);
          const verifiedTime = hasTimestamps && q.startMs !== null ? mmss(q.startMs) : undefined;
          return (
            <li key={`${ref.segmentId}-${ref.start}-${i}`} className="border-l-[3px] border-[var(--accent)] pl-3" data-testid={`quote-${i}`}>
              <p className="text-sm">“{q.text}”</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {q.speaker ? `— ${q.speaker}` : "— from the episode"}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <button type="button" onClick={() => setOpenIdx(openIdx === i ? null : i)} aria-expanded={openIdx === i} className="text-xs">
                  <VerifiedBadge time={verifiedTime ?? undefined} label={verifiedTime ? undefined : "Verified in transcript"} />
                </button>
                <button type="button" onClick={() => swap(i)} className="rounded border px-2 py-0.5 text-xs">
                  Swap
                </button>
                <button type="button" onClick={() => remove(i)} className="rounded border px-2 py-0.5 text-xs">
                  Remove
                </button>
              </div>
              {openIdx === i && (
                <div role="dialog" aria-label="Verified quote" className="mt-2 rounded-md border bg-[var(--surface)] p-3 text-sm shadow-[0_8px_24px_rgb(17_24_39/0.12)]" data-testid="quote-popover">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {verifiedTime ? `✓ Verified · ${verifiedTime} — exact words from audio` : "✓ Verified in transcript — exact words"}
                  </p>
                  <p className="mb-3">{q.around}</p>
                  <button
                    type="button"
                    onClick={() => void playFrom(q.startMs)}
                    className="rounded-md border px-3 py-1.5 text-sm"
                    data-testid="play-from"
                  >
                    ▶ Play from {verifiedTime ?? "transcript"}
                  </button>
                  {audioNote && <p className="mt-2 text-xs text-[var(--warning)]">{audioNote}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
