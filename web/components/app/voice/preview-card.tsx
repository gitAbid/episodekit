"use client";

// MK-2/MK-8 preview card: a short sample paragraph written in the saved (or
// current) voice. [Update preview] posts the live editor state to
// /api/show/voice/preview; a deterministic (no-AI) answer is labelled with
// the §6 fallback copy instead of passing as model text.
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { VOICE_BASIC_PREVIEW_COPY } from "@/lib/copy";

type PreviewRequestProfile = {
  tone: string[];
  formality: number;
  energy: number;
  humor: number;
  person: string;
  sentenceLength: string;
  emoji: string;
  neverSay: string[];
};

type PreviewResponse = {
  status?: "ai" | "deterministic";
  text?: string;
  error?: string;
};

export function VoicePreviewCard({
  profile,
  autoLoad = false,
}: {
  profile: PreviewRequestProfile;
  autoLoad?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const [basic, setBasic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const autoLoaded = useRef(false);

  const update = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/show/voice/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const data = (await res.json().catch(() => ({}))) as PreviewResponse;
      if (!res.ok || !data.text) {
        setFailed(true);
        return;
      }
      setText(data.text);
      setBasic(data.status === "deterministic");
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (autoLoaded.current || !autoLoad) return;
    autoLoaded.current = true;
    void update();
  }, [autoLoad, update]);

  return (
    <div className="rounded-lg border p-4" data-testid="voice-preview-card">
      <span className="text-micro text-faint">PREVIEW</span>
      {text !== null ? (
        <p className="mt-2 text-small leading-[22px]" data-testid="preview-text">
          {text}
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-2" aria-hidden data-testid="preview-skeleton">
          <div className="h-3.5 w-full rounded bg-surface-3" />
          <div className="h-3.5 w-4/5 rounded bg-surface-3" />
          <div className="h-3.5 w-3/5 rounded bg-surface-3" />
        </div>
      )}
      <span aria-live="polite" className="sr-only" data-testid="preview-status">
        {loading ? "Writing a preview." : text ? "Preview ready." : ""}
      </span>
      {basic ? (
        <span className="mt-2 block text-micro text-faint" data-testid="preview-note">
          {VOICE_BASIC_PREVIEW_COPY}
        </span>
      ) : null}
      {failed ? (
        <span role="alert" className="mt-2 block text-small text-danger" data-testid="preview-error">
          Something went wrong. Try again.
        </span>
      ) : null}
      <div className="mt-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={update}
          disabled={loading}
          data-testid="preview-update"
        >
          {loading ? "Writing…" : "Update preview"}
        </Button>
      </div>
    </div>
  );
}
