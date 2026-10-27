import { z } from "zod";
import { SHOW_NAME_REQUIRED_COPY, URL_INVALID_COPY } from "@/lib/copy";

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

/** PATCH accepts any subset of the General settings fields (M9). */
export const showPatchSchema = showCreateSchema.partial();

export const rssPreviewSchema = z.object({
  url: z.string().trim().min(1).max(2048),
});

export type ShowCreateInput = z.infer<typeof showCreateSchema>;
export type ShowPatchInput = z.infer<typeof showPatchSchema>;

export function firstErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Something went wrong. Try again.";
}
