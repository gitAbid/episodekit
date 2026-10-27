"use client";
// Transcript panel (MK-6 right column): searchable transcript lines with
// mm:ss timestamps; source text for every verified quote.
import { useState } from "react";
import type { TranscriptSegment } from "@/lib/pipeline/client";

function mmss(ms: number | null): string {
  if (ms === null) return "--:--";
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function TranscriptPanel({ segments }: { segments: TranscriptSegment[] }) {
  const [query, setQuery] = useState("");
  const filtered = query
    ? segments.filter((s) => s.text.toLowerCase().includes(query.toLowerCase()))
    : segments;
  return (
    <section className="p-4" aria-label="Transcript">
      <h2 className="mb-2 text-sm font-semibold">Transcript</h2>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search transcript"
        className="mb-3 w-full rounded-md border px-3 py-1.5 text-sm"
        data-testid="transcript-search"
      />
      <ol className="flex flex-col gap-2">
        {filtered.map((s) => (
          <li key={s.id} className="text-sm">
            <span className="mr-2 font-mono text-xs text-muted-foreground">{mmss(s.startMs)}</span>
            {s.speaker && <span className="mr-1 font-medium">{s.speaker}:</span>}
            {s.text}
          </li>
        ))}
      </ol>
      {filtered.length === 0 && <p className="text-sm text-muted-foreground">No matches.</p>}
    </section>
  );
}
