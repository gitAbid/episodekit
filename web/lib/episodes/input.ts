/**
 * Request schemas for the intake routes (§7.5). zod 4 (see DECISIONS.md:
 * count constraints live on the array, not the object).
 */
import { z } from "zod";

export const episodeCreateSchema = z.object({
  source: z.enum(["upload", "paste", "sample"]),
  /** Paste/sample path: the transcript text (parsed server-side). */
  transcriptText: z.string().optional(),
  /** §7.5 shape: chunk blob pathnames (parallel to chunkOffsetsMs). */
  blobPaths: z.array(z.string().min(1)).optional(),
  /** §8.3: each chunk's absolute start in ms (parallel to blobPaths). */
  chunkOffsetsMs: z.array(z.number().int().nonnegative()).optional(),
  title: z.string().max(200).optional(),
  number: z.number().int().min(0).max(10000).optional(),
  guests: z.array(z.string().min(1).max(80)).max(10).optional(),
});

export const episodeTranscribeSchema = z.object({
  /** Chunk manifest from the upload flow; falls back to the stored manifest. */
  chunks: z
    .array(
      z.object({
        path: z.string().min(1),
        offsetMs: z.number().int().nonnegative(),
      }),
    )
    .max(64)
    .optional(),
});

/**
 * Upload allow-list (M2) + ≤300 MB compressed cap (§7.5 /api/uploads/token).
 * Moved here from the WP-05 billing stub at integration: these are intake
 * concerns; lib/billing/entitlements (WP-08) owns plan limits and quota.
 */
export const MAX_UPLOAD_BYTES = 300 * 1000 * 1000;

export const AUDIO_UPLOAD_EXTENSIONS = ["mp3", "m4a", "wav", "aac", "ogg", "webm", "mp4", "mov"] as const;

export const AUDIO_UPLOAD_CONTENT_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/vorbis",
  "audio/webm",
  "video/webm",
  "video/mp4",
  "video/quicktime",
] as const;
