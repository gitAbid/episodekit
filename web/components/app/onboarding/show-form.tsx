"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RSS_ERROR_COPY, SAVE_UNAVAILABLE_COPY } from "@/lib/copy";

type PreviewResponse = { name?: string | null; artworkUrl?: string | null; error?: string };

export function ShowOnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rssUrl, setRssUrl] = useState("");
  const [artworkUrl, setArtworkUrl] = useState("");
  const [rssError, setRssError] = useState<string | null>(null);
  const [checkingRss, setCheckingRss] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function prefillFromRss() {
    const url = rssUrl.trim();
    if (!url || checkingRss) return;
    setRssError(null);
    setCheckingRss(true);
    try {
      const res = await fetch("/api/rss/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json().catch(() => ({}))) as PreviewResponse;
      if (!res.ok) {
        setRssError(data.error ?? RSS_ERROR_COPY);
        return;
      }
      // Prefill only empty fields so typed values are never overwritten (U2).
      if (data.name && name.trim() === "") setName(data.name);
      if (data.artworkUrl) setArtworkUrl(data.artworkUrl);
    } catch {
      setRssError(RSS_ERROR_COPY);
    } finally {
      setCheckingRss(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/show", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          rssUrl: rssUrl.trim() || undefined,
          artworkUrl: artworkUrl.trim() || undefined,
        }),
      });
      if (res.status === 503) {
        setSaveError(SAVE_UNAVAILABLE_COPY);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      router.push("/app/onboarding/voice");
    } catch {
      setSaveError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" data-testid="onboarding-show-form">
      <div className="flex flex-col gap-1">
        <label htmlFor="show-name" className="text-sm font-medium">
          Show name
        </label>
        <input
          id="show-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="The Focus Hour"
          autoComplete="off"
          className="w-full rounded-md border px-3 py-2 text-sm"
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="rss-url" className="text-sm font-medium">
          RSS URL <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            id="rss-url"
            type="url"
            value={rssUrl}
            onChange={(e) => {
              setRssUrl(e.target.value);
              setRssError(null);
            }}
            placeholder="https://feeds.example.com/show"
            autoComplete="off"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={prefillFromRss}
            disabled={checkingRss || rssUrl.trim() === ""}
            data-testid="prefill-rss"
            className="whitespace-nowrap rounded-md border px-3 py-2 text-sm font-medium"
          >
            {checkingRss ? "Checking…" : "Fill from RSS"}
          </button>
        </div>
        <span className="text-xs text-neutral-500">
          Optional. We fill in the name and artwork.
        </span>
        {rssError ? (
          <span role="alert" className="text-sm text-red-700" data-testid="rss-error">
            {rssError}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="artwork-url" className="text-sm font-medium">
          Artwork URL <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <input
          id="artwork-url"
          type="url"
          value={artworkUrl}
          onChange={(e) => setArtworkUrl(e.target.value)}
          placeholder="https://cdn.example.com/cover.jpg"
          autoComplete="off"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        {artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artworkUrl}
            alt="Show artwork preview"
            className="mt-1 h-16 w-16 rounded-md border object-cover"
          />
        ) : null}
      </div>

      {saveError ? (
        <span role="alert" className="text-sm text-red-700" data-testid="save-error">
          {saveError}
        </span>
      ) : null}

      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={saving || name.trim() === ""}
          data-testid="continue-show"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </form>
  );
}
