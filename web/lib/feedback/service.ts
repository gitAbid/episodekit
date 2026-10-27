// M11 — feedback pipeline: store (feedback table) + PostHog event + owner
// email via Resend. Framework-free core with injected ports; the route file
// wires the DB/Clerk implementations.
import { z } from "zod";
import { ARTIFACT_KINDS } from "@/lib/artifacts/schemas";
import { posthogConfigured } from "@/lib/analytics/posthog";

export const FeedbackInputSchema = z
  .object({
    rating: z.union([z.literal(1), z.literal(-1)]).nullish(),
    note: z.string().trim().max(2_000).nullish(),
    artifactKind: z.enum(ARTIFACT_KINDS).nullish(),
    episodeId: z.string().uuid().nullish(),
    page: z.string().trim().max(200).nullish(),
  })
  .refine((v) => v.rating != null || (v.note != null && v.note.length > 0), {
    message: "rating or note required",
  });
export type FeedbackInput = z.output<typeof FeedbackInputSchema>;

export interface FeedbackRow {
  userId: string | null;
  episodeId: string | null;
  artifactKind: string | null;
  rating: number | null;
  note: string | null;
}

export interface FeedbackPorts {
  /** Persist the row. Omitted/null → 503 (no DB). */
  insert?: ((row: FeedbackRow) => Promise<void>) | null;
  /** Server PostHog capture (key absent → skipped silently upstream). */
  capture?: (event: string, props: Record<string, unknown>) => Promise<void> | void;
  /** Owner notification. null/absent key → seam logged once, no email. */
  notify?: ((row: FeedbackRow) => Promise<void>) | null;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}

export interface FeedbackResponse {
  status: number;
  body: Record<string, unknown>;
}

let seamLogged = false;

export async function handleFeedback(
  userId: string | null,
  raw: unknown,
  ports: FeedbackPorts = {},
): Promise<FeedbackResponse> {
  if (!userId) return { status: 401, body: { error: "unauthenticated" } };

  const parsed = FeedbackInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: "invalid_input", detail: parsed.error.issues.slice(0, 3).map((i) => i.message) },
    };
  }

  const row: FeedbackRow = {
    userId,
    episodeId: parsed.data.episodeId ?? null,
    artifactKind: parsed.data.artifactKind ?? null,
    rating: parsed.data.rating ?? null,
    note: parsed.data.note?.length ? parsed.data.note : null,
  };

  if (!ports.insert) return { status: 503, body: { error: "storage_unavailable" } };
  try {
    await ports.insert(row);
  } catch (err) {
    console.error("[feedback] insert failed:", err);
    return { status: 503, body: { error: "storage_failed" } };
  }

  // PostHog (key absent → captureServerEvent no-ops and returns false).
  const env = ports.env ?? process.env;
  if (posthogConfigured(env)) {
    await ports.capture?.("feedback_submitted", {
      rating: row.rating,
      artifact_kind: row.artifactKind,
      has_note: row.note != null,
      note_length: row.note?.length ?? 0,
      // page is analytics-only: the §7.1 feedback table has no such column
      page: parsed.data.page ?? null,
      note: row.note?.slice(0, 500),
    });
  }

  // Owner email via Resend — only when the key exists; otherwise log the seam.
  if (ports.notify) {
    try {
      await ports.notify(row);
    } catch (err) {
      console.error("[feedback] notify failed:", err);
    }
  } else if (!seamLogged) {
    seamLogged = true;
    console.info(
      "[feedback] RESEND_API_KEY not set — feedback is stored but not emailed to the owner.",
    );
  }

  return { status: 200, body: { ok: true } };
}

// ---- Resend owner notification (used as the `notify` port by the route) ------

export function ownerEmailRecipients(env: NodeJS.ProcessEnv): string[] {
  return (env.OWNER_EMAILS ?? "")
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

export async function notifyOwnerByResend(
  row: FeedbackRow,
  opts?: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch },
): Promise<boolean> {
  const env = opts?.env ?? process.env;
  const key = env.RESEND_API_KEY;
  const to = ownerEmailRecipients(env);
  if (!key || !to.length) return false;
  const from = env.FEEDBACK_FROM_EMAIL || "EpisodeKit <onboarding@resend.dev>";
  const subject = `EpisodeKit feedback ${row.rating === 1 ? "👍" : row.rating === -1 ? "👎" : ""}`.trim();
  const lines = [
    row.artifactKind ? `Artifact: ${row.artifactKind}` : null,
    `Rating: ${row.rating === 1 ? "up" : row.rating === -1 ? "down" : "—"}`,
    row.note ? `\nNote:\n${row.note}` : null,
  ].filter(Boolean);
  try {
    const res = await (opts?.fetchImpl ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to, subject, text: lines.join("\n") }),
    });
    if (!res.ok) console.error("[feedback] resend http", res.status);
    return res.ok;
  } catch (err) {
    console.error("[feedback] resend failed:", err instanceof Error ? err.message : String(err));
    return false;
  }
}
