"use client";
// M6/M7 toolbar: Regenerate ▾ (presets + custom ≤200 chars), Copy ▾
// (destinations; last used becomes the button label), Download all (.md).
import { useEffect, useRef, useState } from "react";
import type { ArtifactKindName, ArtifactView } from "@/lib/pipeline/client";
import {
  DESTINATION_LABELS,
  blogToMarkdown,
  downloadAllMarkdown,
  needsShortening,
  newsletterToText,
  quotesToText,
  shortenToLimit,
  showNotesToText,
  socialToText,
  summaryToText,
  titlesToText,
  type Destination,
} from "@/lib/export/format";
import type { TranscriptSegment } from "@/lib/pipeline/client";
import { toast } from "sonner";

const REGEN_PRESETS = ["Shorter", "Punchier", "More casual", "More formal"] as const;
const DESTINATIONS: Destination[] = ["apple", "spotify", "youtube", "markdown", "plain"];

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return ref;
}

function Menu({ label, testId, children }: { label: string; testId?: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--surface-2)]"
      >
        {label} ▾
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-50 mt-1 min-w-[13rem] rounded-md border bg-[var(--surface)] p-1 shadow-lg">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function Item({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-2)]"
    >
      {children}
    </button>
  );
}

export function RegenerateMenu({
  onRegenerate,
  disabled,
}: {
  onRegenerate: (instruction?: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [custom, setCustom] = useState("");
  const [mode, setMode] = useState<"idle" | "custom">("idle");
  return (
    <Menu label="Regenerate" testId="regenerate-menu">
      {(close) => (
        <>
          {REGEN_PRESETS.map((preset) => (
            <Item
              key={preset}
              onClick={() => {
                close();
                void onRegenerate(preset);
              }}
            >
              {preset}
            </Item>
          ))}
          {mode === "custom" ? (
            <form
              className="flex gap-1 p-1"
              onSubmit={(e) => {
                e.preventDefault();
                close();
                void onRegenerate(custom.slice(0, 200) || undefined);
                setCustom("");
                setMode("idle");
              }}
            >
              <input
                autoFocus
                value={custom}
                onChange={(e) => setCustom(e.target.value.slice(0, 200))}
                placeholder="Instructions (≤200 chars)"
                className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
                data-testid="regen-custom-input"
              />
              <button type="submit" className="rounded border px-2 py-1 text-sm">
                Go
              </button>
            </form>
          ) : (
            <Item onClick={() => setMode("custom")}>Custom…</Item>
          )}
          {disabled && <p className="px-2 py-1 text-xs text-muted-foreground">Working…</p>}
        </>
      )}
    </Menu>
  );
}

function chapterLines(chapters: { startMs: number; title: string }[], dest: Destination): string {
  return chapters
    .map((c) => {
      const s = Math.floor(c.startMs / 1000);
      const mm = Math.floor(s / 60);
      const ss = String(s % 60).padStart(2, "0");
      const ts = dest === "youtube" ? `${mm}:${ss}` : `${String(mm).padStart(2, "0")}:${ss}`;
      return `${ts} ${c.title}`;
    })
    .join("\n");
}

export function CopyMenu(props: {
  kind: ArtifactKindName;
  artifact: ArtifactView;
  segments: TranscriptSegment[];
  showName: string;
  episodeTitle: string | null;
  freePlan: boolean;
  chapters: { startMs: number; title: string }[];
}) {
  const [lastUsed, setLastUsed] = useState<Destination | null>(null);
  const content = (props.artifact.content ?? {}) as Record<string, unknown>;
  const ctx = {
    segments: props.segments,
    showName: props.showName,
    episodeTitle: props.episodeTitle,
    freePlan: props.freePlan,
  };

  const textFor = (dest: Destination): string => {
    switch (props.kind) {
      case "show_notes":
        return showNotesToText(content, ctx, dest, props.chapters);
      case "chapters":
        return chapterLines(props.chapters, dest);
      case "summary":
        return summaryToText(content);
      case "titles":
        return titlesToText(content);
      case "blog":
        return blogToMarkdown(content, ctx);
      case "newsletter":
        return newsletterToText(content, ctx);
      case "social":
        return socialToText(content);
      case "quotes":
        return quotesToText(content, ctx);
      default:
        return "";
    }
  };

  const copy = async (dest: Destination): Promise<void> => {
    const text = textFor(dest);
    if (needsShortening(dest, text)) {
      // U13: over the destination limit — shorten to fit and say so.
      await navigator.clipboard.writeText(shortenToLimit(text, 4000));
      setLastUsed(dest);
      toast(`Copied for ${DESTINATION_LABELS[dest]} (shortened to fit)`);
      return;
    }
    await navigator.clipboard.writeText(text);
    setLastUsed(dest);
    toast(dest === "plain" ? "Copied" : `Copied for ${DESTINATION_LABELS[dest]}`);
  };

  return (
    <Menu label={lastUsed ? `Copy · ${DESTINATION_LABELS[lastUsed]}` : "Copy"} testId="copy-menu">
      {(close) =>
        DESTINATIONS.map((dest) => (
          <Item
            key={dest}
            onClick={() => {
              close();
              void copy(dest);
            }}
          >
            {DESTINATION_LABELS[dest]}
          </Item>
        ))
      }
    </Menu>
  );
}

export function DownloadAllButton(props: {
  artifacts: Record<string, unknown>;
  segments: TranscriptSegment[];
  showName: string;
  episodeTitle: string | null;
  freePlan: boolean;
  chapters: { startMs: number; title: string }[];
}) {
  const download = () => {
    const md = downloadAllMarkdown(
      props.artifacts as Partial<Record<string, Record<string, unknown>>>,
      {
        segments: props.segments,
        showName: props.showName,
        episodeTitle: props.episodeTitle,
        freePlan: props.freePlan,
      },
      props.chapters,
    );
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(props.episodeTitle ?? "episode").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      type="button"
      onClick={download}
      data-testid="download-all"
      className="rounded-md border px-3 py-1.5 text-sm hover:bg-[var(--surface-2)]"
    >
      Download all
    </button>
  );
}
