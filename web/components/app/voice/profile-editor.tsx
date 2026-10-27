"use client";

// §7.4 voice profile editor shared by onboarding step 2 (MK-2 after-learning)
// and Settings → Voice (MK-8): tone chips, 1–5 sliders, segmented options,
// Never say / Always include chips. Pure controlled component — persistence
// belongs to the forms that render it.
import type { VoiceProfile } from "@/lib/ai/voice";
import { VOICE_TONE_HINT_COPY } from "@/lib/copy";
import { Slider } from "@/components/ui/slider";
import { ChipList, Segmented } from "./chip-row";

const SLIDERS = [
  { key: "formality", label: "Formality" },
  { key: "energy", label: "Energy" },
  { key: "humor", label: "Humor" },
] as const;

export function VoiceProfileEditor({
  profile,
  onChange,
  showAlwaysInclude = false,
}: {
  profile: VoiceProfile;
  onChange: (next: VoiceProfile) => void;
  showAlwaysInclude?: boolean;
}) {
  const set = <K extends keyof VoiceProfile>(key: K, value: VoiceProfile[K]) =>
    onChange({ ...profile, [key]: value });

  return (
    <div className="flex flex-col gap-6">
      <ChipList
        label="Tone"
        testIdPrefix="tone"
        items={profile.tone}
        max={3}
        onRemove={(item) => set("tone", profile.tone.filter((t) => t !== item))}
        onAdd={(item) => set("tone", [...profile.tone, item])}
      />

      <div className="flex flex-col gap-4">
        {SLIDERS.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-[90px_1fr_24px] items-center gap-3">
            <span className="text-small font-medium">{label}</span>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[profile[key]]}
              onValueChange={([v]) => set(key, v)}
              ariaLabel={label}
              data-testid={`slider-${key}`}
            />
            <span className="text-right font-mono text-xs tabular-nums" aria-hidden>
              {profile[key]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented
          label="Emoji"
          testIdPrefix="seg-emoji"
          value={profile.emoji}
          onChange={(v) => set("emoji", v)}
          options={[
            { value: "none", label: "None" },
            { value: "light", label: "Light" },
            { value: "heavy", label: "Heavy" },
          ]}
        />
        <Segmented
          label="Write as"
          testIdPrefix="seg-person"
          value={profile.person}
          onChange={(v) => set("person", v)}
          options={[
            { value: "I", label: "I" },
            { value: "we", label: "We" },
            { value: "they", label: "They" },
          ]}
        />
        <Segmented
          label="Sentence length"
          testIdPrefix="seg-sentencelength"
          value={profile.sentenceLength}
          onChange={(v) => set("sentenceLength", v)}
          options={[
            { value: "short", label: "Short" },
            { value: "medium", label: "Medium" },
            { value: "long", label: "Long" },
          ]}
        />
      </div>

      <ChipList
        label="Never say"
        testIdPrefix="never-say"
        items={profile.neverSay}
        max={30}
        onRemove={(item) => set("neverSay", profile.neverSay.filter((t) => t !== item))}
        onAdd={(item) => set("neverSay", [...profile.neverSay, item])}
      />

      {showAlwaysInclude ? (
        <ChipList
          label="Always include"
          testIdPrefix="always-include"
          items={profile.alwaysInclude}
          max={5}
          onRemove={(item) => set("alwaysInclude", profile.alwaysInclude.filter((t) => t !== item))}
          onAdd={(item) => set("alwaysInclude", [...profile.alwaysInclude, item])}
        />
      ) : null}

      {profile.tone.length < 3 ? (
        <span role="status" className="text-small text-warning" data-testid="tone-hint">
          {VOICE_TONE_HINT_COPY}
        </span>
      ) : null}
    </div>
  );
}

/** §7.4 fixes tone at exactly 3 — forms gate Save/Continue on this. */
export function profileComplete(profile: VoiceProfile): boolean {
  return profile.tone.length === 3;
}
