"use client";

// M11 — per-artifact 👍/👎 in the workspace header (MK-6 "☐ Ready 👍 👎").
// A thumb sends immediately with the artifact kind + episode id (stored +
// PostHog when the key exists); the optional note goes through the floating
// Feedback widget (tie-break: fewer clicks — logged in DECISIONS.md WP-09).
import * as React from "react";
import { toast } from "sonner";
import { sendFeedback } from "@/components/app/feedback-widget";
import type { ArtifactKind } from "@/lib/artifacts/schemas";

export function ArtifactFeedback({ kind, episodeId }: { kind: ArtifactKind; episodeId: string }) {
  const [sent, setSent] = React.useState<"up" | "down" | null>(null);

  const rate = async (value: "up" | "down") => {
    if (sent === value) return; // one rating per artifact per session view
    setSent(value);
    const ok = await sendFeedback({
      rating: value === "up" ? 1 : -1,
      artifactKind: kind,
      episodeId,
    });
    if (ok) toast("Thanks — noted");
    else toast("Couldn't send feedback — try again");
  };

  return (
    <span className="flex items-center gap-0.5" data-testid="artifact-feedback">
      <button
        type="button"
        aria-label="Helpful"
        aria-pressed={sent === "up"}
        onClick={() => void rate("up")}
        className={`flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground ${sent === "up" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : ""}`}
      >
        👍
      </button>
      <button
        type="button"
        aria-label="Not helpful"
        aria-pressed={sent === "down"}
        onClick={() => void rate("down")}
        className={`flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground ${sent === "down" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : ""}`}
      >
        👎
      </button>
    </span>
  );
}
