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
