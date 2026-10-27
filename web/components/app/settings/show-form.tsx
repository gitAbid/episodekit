"use client";

import { useState, type FormEvent } from "react";

export type ShowSettings = {
  name: string;
  artworkUrl: string;
  listenUrl: string;
  defaultCta: string;
  vocabulary: string[];
};

type Props = { show: ShowSettings };

export function ShowSettingsForm({ show }: Props) {
  const [name, setName] = useState(show.name);
  const [artworkUrl, setArtworkUrl] = useState(show.artworkUrl);
  const [listenUrl, setListenUrl] = useState(show.listenUrl);
  const [defaultCta, setDefaultCta] = useState(show.defaultCta);
  const [vocabulary, setVocabulary] = useState(show.vocabulary.join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const terms = vocabulary
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const res = await fetch("/api/show", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          artworkUrl: artworkUrl.trim() || undefined,
          listenUrl: listenUrl.trim() || undefined,
          defaultCta: defaultCta.trim() || undefined,
          vocabulary: terms,
        }),
      });
      if (res.status === 503) {
        setError("Saving is unavailable in this preview.");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-md border px-3 py-2 text-sm";

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-5" data-testid="show-settings-form">
      <div className="flex flex-col gap-1">
        <label htmlFor="settings-name" className="text-sm font-medium">
          Show name
        </label>
        <input
          id="settings-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          className={inputClass}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="settings-artwork" className="text-sm font-medium">
          Artwork URL
        </label>
        <input
          id="settings-artwork"
          type="url"
          value={artworkUrl}
          onChange={(e) => {
            setArtworkUrl(e.target.value);
            setSaved(false);
          }}
          placeholder="https://cdn.example.com/cover.jpg"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="settings-listen" className="text-sm font-medium">
          Listen link
        </label>
        <input
          id="settings-listen"
          type="url"
          value={listenUrl}
          onChange={(e) => {
            setListenUrl(e.target.value);
            setSaved(false);
          }}
          placeholder="https://podcasts.apple.com/…"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="settings-cta" className="text-sm font-medium">
          Default CTA
        </label>
        <input
          id="settings-cta"
          value={defaultCta}
          onChange={(e) => {
            setDefaultCta(e.target.value);
            setSaved(false);
          }}
          placeholder="Invite listeners to follow the show."
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="settings-vocabulary" className="text-sm font-medium">
          Vocabulary terms
        </label>
        <textarea
          id="settings-vocabulary"
          rows={4}
          value={vocabulary}
          onChange={(e) => {
            setVocabulary(e.target.value);
            setSaved(false);
          }}
          placeholder={"One per line. Names and jargon."}
          className={inputClass}
        />
        <span className="text-xs text-neutral-500">One per line. Names and jargon.</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          data-testid="save-settings"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved ? (
          <span role="status" className="text-sm text-emerald-700" data-testid="saved-indicator">
            Saved
          </span>
        ) : null}
        {error ? (
          <span role="alert" className="text-sm text-red-700" data-testid="settings-error">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
