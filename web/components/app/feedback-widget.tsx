"use client";

// M11 — floating "Feedback" button → 👍/👎 (FeedbackThumbs) + note →
// POST /api/feedback (stored + PostHog when the key exists). WP-06 seam: the
// workspace passes `artifactKind` per artifact to sendFeedback() — the same
// wiring, one call site.
import * as React from "react";
import { MessageSquareIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackThumbs } from "@/components/app/feedback-thumbs";
import type { ArtifactKind } from "@/lib/artifacts/schemas";

export async function sendFeedback(input: {
  rating?: 1 | -1;
  note?: string;
  artifactKind?: ArtifactKind;
  episodeId?: string;
  page?: string;
}): Promise<boolean> {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.ok;
}

export function FeedbackWidget({ page }: { page?: string }) {
  const [open, setOpen] = React.useState(false);
  const [rating, setRating] = React.useState<1 | -1 | null>(null);
  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);

  async function submit() {
    if (rating == null && !note.trim()) {
      toast("Pick a thumb or write a note first");
      return;
    }
    setSending(true);
    const ok = await sendFeedback({ rating: rating ?? undefined, note: note.trim() || undefined, page });
    setSending(false);
    if (ok) {
      toast("Sent — thank you");
      setOpen(false);
      setRating(null);
      setNote("");
    } else {
      toast("Couldn't send feedback — try again");
    }
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        className="fixed right-4 bottom-4 z-40 shadow-md"
        onClick={() => setOpen(true)}
      >
        <MessageSquareIcon data-icon="inline-start" aria-hidden />
        Feedback
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Send feedback"
      className="fixed right-4 bottom-4 z-40 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Feedback</span>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setOpen(false)}>
          <XIcon aria-hidden />
        </Button>
      </div>
      <FeedbackThumbs onFeedback={(v) => setRating(v === "up" ? 1 : -1)} />
      <Textarea
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What worked, what didn't?"
        aria-label="Feedback note"
        maxLength={2000}
      />
      <Button onClick={submit} disabled={sending}>
        {sending ? "Sending…" : "Send"}
      </Button>
    </div>
  );
}
