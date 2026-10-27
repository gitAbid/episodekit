"use client";

// Onboarding step 2 (M1, MK-2, U3): paste 1–3 past show notes (≥150 words
// each), "Learn my voice" → chips/sliders, or "Skip for now" → the §7.4
// default stays (null profile). The deterministic no-AI answer is labelled;
// keyless previews say saving is unavailable instead of faking a save.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { VoiceProfile } from "@/lib/ai/voice";
import {
  SAVE_UNAVAILABLE_COPY,
  SAMPLE_TOO_SHORT_COPY,
  VOICE_BASIC_PROFILE_COPY,
} from "@/lib/copy";
import { MIN_SAMPLE_WORDS, countWords } from "@/lib/words";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { profileComplete, VoiceProfileEditor } from "@/components/app/voice/profile-editor";
import { VoicePreviewCard } from "@/components/app/voice/preview-card";

type LearnResponse = {
  status?: "learned" | "deterministic";
  profile?: VoiceProfile;
  saved?: boolean;
  error?: string;
};

export function VoiceOnboardingForm() {
  const router = useRouter();
  const [samples, setSamples] = useState<string[]>([""]);
  const [phase, setPhase] = useState<"collect" | "learned">("collect");
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [learnSaved, setLearnSaved] = useState(false);
  const [deterministic, setDeterministic] = useState(false);
  const [learning, setLearning] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = useMemo(
    () => samples.map((s) => s.trim()).filter((s) => s.length > 0),
    [samples],
  );
  const canLearn = filled.length > 0 && filled.every((s) => countWords(s) >= MIN_SAMPLE_WORDS);

  function updateSample(index: number, value: string) {
    setSamples((current) => current.map((s, i) => (i === index ? value : s)));
  }

  async function learn() {
    if (learning || !canLearn) return;
    setError(null);
    setLearning(true);
    try {
      const res = await fetch("/api/show/voice/learn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ samples: filled }),
      });
      const data = (await res.json().catch(() => ({}))) as LearnResponse;
      if (!res.ok || !data.profile) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setProfile(data.profile);
      setLearnSaved(data.saved === true);
      setDeterministic(data.status === "deterministic");
      setPhase("learned");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLearning(false);
    }
  }

  async function continueToFirstEpisode() {
    if (!profile || continuing) return;
    setContinuing(true);
    try {
      if (learnSaved) {
        const res = await fetch("/api/show", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ voiceProfile: profile }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status === 503) {
            setError(SAVE_UNAVAILABLE_COPY);
          } else {
            setError(data.error ?? "Something went wrong. Try again.");
          }
          setContinuing(false);
          return;
        }
      }
      router.push("/app/onboarding/first");
    } catch {
      setError("Something went wrong. Try again.");
      setContinuing(false);
    }
  }

  if (phase === "learned" && profile) {
    return (
      <div className="flex flex-col gap-6" data-testid="voice-learned">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold leading-[30px]">Here&apos;s your voice</h1>
          <p className="text-small text-body">
            Adjust anything. You can change this later in Settings.
          </p>
        </div>

        {deterministic ? (
          <span className="rounded-md bg-warning-soft px-3 py-2 text-small text-warning" data-testid="voice-note">
            {VOICE_BASIC_PROFILE_COPY}
          </span>
        ) : null}
        {!learnSaved ? (
          <span className="rounded-md bg-surface-2 px-3 py-2 text-small text-body" data-testid="voice-saved-note">
            {SAVE_UNAVAILABLE_COPY}
          </span>
        ) : null}

        <VoiceProfileEditor profile={profile} onChange={setProfile} />
        <VoicePreviewCard profile={profile} autoLoad />

        {error ? (
          <span role="alert" className="text-small text-danger" data-testid="voice-error">
            {error}
          </span>
        ) : null}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push("/app/onboarding/show")}
            data-testid="back-to-show"
          >
            ← Back
          </Button>
          <Button
            type="button"
            onClick={continueToFirstEpisode}
            disabled={!profileComplete(profile) || continuing}
            data-testid="continue-voice"
          >
            {continuing ? "Saving…" : "Continue"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="voice-collect">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-[30px]">Teach EpisodeKit your voice</h1>
        <p className="text-small text-body">
          Paste 1–3 past show notes or newsletters. We&apos;ll match how you write.
        </p>
      </div>

      {samples.map((sample, index) => {
        const words = countWords(sample);
        return (
          <div key={index} className="flex flex-col gap-1">
            <label htmlFor={`voice-sample-${index}`} className="text-small font-medium">
              Example {index + 1}
            </label>
            <Textarea
              id={`voice-sample-${index}`}
              rows={6}
              value={sample}
              onChange={(e) => updateSample(index, e.target.value)}
              data-testid={`voice-sample-${index}`}
            />
            <div className="flex items-center justify-between">
              <span
                className="font-mono text-xs tabular-nums text-faint"
                aria-live="polite"
                data-testid={`sample-counter-${index}`}
              >
                {words} words · at least {MIN_SAMPLE_WORDS}
              </span>
              {index === samples.length - 1 && samples.length < 3 ? (
                <button
                  type="button"
                  className="text-small underline"
                  onClick={() => setSamples((current) => [...current, ""])}
                  data-testid={`add-sample-${index}`}
                >
                  + Add another example
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      {error ? (
        <span role="alert" className="text-small text-danger" data-testid="voice-error">
          {error}
        </span>
      ) : null}
      {filled.length > 0 && !canLearn ? (
        <span role="status" className="text-small text-warning" data-testid="voice-min-hint">
          {SAMPLE_TOO_SHORT_COPY}
        </span>
      ) : null}

      <div className="flex items-center justify-between">
        <Button type="button" onClick={learn} disabled={!canLearn || learning} data-testid="learn-voice">
          {learning ? "Learning your voice…" : "Learn my voice"}
        </Button>
        <button
          type="button"
          className="text-small underline"
          onClick={() => router.push("/app/onboarding/first")}
          data-testid="skip-voice"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
