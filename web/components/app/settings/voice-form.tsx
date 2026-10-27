"use client";

// Settings → Voice (M9, MK-8): left — profile editor + writing samples +
// [Save voice]; right — preview card with [Update preview]. Everything saves
// through PATCH /api/show (voiceProfile + voiceSamples), validated by the
// shared §7.4 schema server-side.
import { useState } from "react";
import type { VoiceProfile } from "@/lib/ai/voice";
import { SAVE_UNAVAILABLE_COPY } from "@/lib/copy";
import { MIN_SAMPLE_WORDS, countWords } from "@/lib/words";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { profileComplete, VoiceProfileEditor } from "@/components/app/voice/profile-editor";
import { VoicePreviewCard } from "@/components/app/voice/preview-card";

type SaveResponse = { show?: unknown; error?: string };

function snippet(text: string): string {
  const firstLine = text.trim().split("\n")[0] ?? "";
  return firstLine.length > 44 ? `${firstLine.slice(0, 44).trimEnd()}…` : firstLine;
}

export function VoiceSettingsForm({
  profile: initialProfile,
  samples: initialSamples,
}: {
  profile: VoiceProfile;
  samples: string[];
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [samples, setSamples] = useState(initialSamples);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftWords = countWords(draft);
  const draftValid = draftWords >= MIN_SAMPLE_WORDS;

  function addDraft() {
    if (!draftValid) return;
    setSamples((current) => [...current, draft.trim()]);
    setDraft("");
    setAdding(false);
    setSaved(false);
  }

  function removeSample(index: number) {
    setSamples((current) => current.filter((_, i) => i !== index));
    setSaved(false);
  }

  async function save() {
    if (saving) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/show", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voiceProfile: profile, voiceSamples: samples }),
      });
      const data = (await res.json().catch(() => ({}))) as SaveResponse;
      if (res.status === 503) {
        setError(SAVE_UNAVAILABLE_COPY);
        return;
      }
      if (!res.ok) {
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

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6 rounded-lg border p-5" data-testid="voice-settings-editor">
        <VoiceProfileEditor profile={profile} onChange={setProfile} showAlwaysInclude />

        <div className="flex flex-col gap-2" data-testid="voice-samples">
          <span className="text-small font-medium">Writing samples</span>
          {samples.map((sample, index) => (
            <div
              key={`${index}-${sample.slice(0, 12)}`}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-small"
              data-testid={`voice-sample-row-${index}`}
            >
              <span className="min-w-0 truncate text-body">
                {snippet(sample)} · {countWords(sample)} words
              </span>
              <button
                type="button"
                className="shrink-0 text-small underline"
                onClick={() => removeSample(index)}
                data-testid={`remove-sample-${index}`}
              >
                Remove
              </button>
            </div>
          ))}
          {adding ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="new-voice-sample" className="text-small font-medium">
                New sample
              </label>
              <Textarea
                id="new-voice-sample"
                rows={6}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                data-testid="new-voice-sample"
              />
              <span
                className="font-mono text-xs tabular-nums text-faint"
                aria-live="polite"
                data-testid="new-sample-counter"
              >
                {draftWords} words · at least {MIN_SAMPLE_WORDS}
              </span>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={addDraft} disabled={!draftValid} data-testid="confirm-add-sample">
                  Add sample
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft("");
                    setAdding(false);
                  }}
                  data-testid="cancel-add-sample"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => setAdding(true)}
              disabled={samples.length >= 3}
              data-testid="add-sample"
            >
              + Add sample
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={save}
            disabled={saving || !profileComplete(profile)}
            data-testid="save-voice"
          >
            {saving ? "Saving…" : "Save voice"}
          </Button>
          <span className="text-small text-faint">Used for every new episode.</span>
          {saved ? (
            <span role="status" className="text-small text-success" data-testid="voice-saved">
              Saved
            </span>
          ) : null}
          {error ? (
            <span role="alert" className="text-small text-danger" data-testid="voice-error">
              {error}
            </span>
          ) : null}
        </div>
      </div>

      <VoicePreviewCard profile={profile} autoLoad />
    </div>
  );
}
