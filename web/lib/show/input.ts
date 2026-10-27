import { z } from "zod";
import {
  SAMPLE_LIMIT_COPY,
  SAMPLE_TOO_SHORT_COPY,
  SHOW_NAME_REQUIRED_COPY,
  URL_INVALID_COPY,
} from "@/lib/copy";
import { VoiceProfileSchema } from "@/lib/ai/voice";
import { MIN_SAMPLE_WORDS, countWords } from "@/lib/words";

export { MIN_SAMPLE_WORDS, countWords };

const emptyStringToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalHttpUrl = () =>
  z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .trim()
      .max(2048)
      .refine((v) => {
        try {
          const u = new URL(v);
          return u.protocol === "https:" || u.protocol === "http:";
        } catch {
          return false;
        }
      }, URL_INVALID_COPY)
      .optional(),
  );

const requiredText = (max: number) => z.string().trim().max(max);

export const showCreateSchema = z.object({
  // Coerce a missing name to "" so the friendly message (not zod's type error) is shown.
  name: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    requiredText(120).refine((v) => v.length > 0, SHOW_NAME_REQUIRED_COPY),
  ),
  rssUrl: optionalHttpUrl(),
  artworkUrl: optionalHttpUrl(),
  listenUrl: optionalHttpUrl(),
  defaultCta: z.preprocess(emptyStringToUndefined, requiredText(240).optional()),
  vocabulary: z.array(requiredText(60).refine((v) => v.length > 0)).max(50).optional(),
});

// ---- voice (M1 step 2, §7.5) -------------------------------------------------

/** M1: past show notes of at least 150 words, up to 3, each ≤50k chars. */
export const MAX_SAMPLE_CHARS = 50_000;

export const voiceSampleSchema = z
  .string()
  .trim()
  .min(1, SAMPLE_TOO_SHORT_COPY)
  .max(MAX_SAMPLE_CHARS, SAMPLE_TOO_SHORT_COPY)
  .refine((v) => countWords(v) >= MIN_SAMPLE_WORDS, SAMPLE_TOO_SHORT_COPY);

function voiceSampleArray() {
  return z
    .array(voiceSampleSchema)
    .min(1, SAMPLE_TOO_SHORT_COPY)
    .max(3, SAMPLE_LIMIT_COPY);
}

/** POST /api/show/voice/learn — 1–3 past show notes (M1/U3). */
export const voiceLearnSchema = z.object({
  samples: voiceSampleArray(),
});

/** POST /api/show/voice/preview — profile to preview (stored one when absent). */
export const voicePreviewSchema = z.object({
  profile: z.unknown().optional(),
  topic: z.string().trim().max(200).optional(),
});

/** PATCH accepts any subset of the General settings fields (M9), plus the
 * §7.4 voice profile / samples the Voice settings page and onboarding step 2
 * save (profile validated by the shared WP-04 schema). */
export const showPatchSchema = showCreateSchema.partial().extend({
  voiceProfile: VoiceProfileSchema.optional(),
  voiceSamples: voiceSampleArray().optional(),
});

export const rssPreviewSchema = z.object({
  url: z.string().trim().min(1).max(2048),
});

export type ShowCreateInput = z.infer<typeof showCreateSchema>;
export type ShowPatchInput = z.infer<typeof showPatchSchema>;

export function firstErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Something went wrong. Try again.";
}
