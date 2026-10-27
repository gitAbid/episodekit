import { SAVE_UNAVAILABLE_COPY, NO_SHOW_COPY } from "@/lib/copy";
import { isDbConfigured } from "@/lib/env";
import type { ApiResult } from "@/lib/rss/preview";
import * as queries from "@/db/queries";
import type { ShowRow } from "@/db/queries";
import { firstErrorMessage, showCreateSchema, showPatchSchema } from "./input";

export type SerializedShow = {
  id: string;
  name: string;
  rssUrl: string | null;
  artworkUrl: string | null;
  listenUrl: string | null;
  defaultCta: string | null;
  vocabulary: string[];
};

export function serializeShow(show: ShowRow): SerializedShow {
  return {
    id: show.id,
    name: show.name,
    rssUrl: show.rssUrl,
    artworkUrl: show.artworkUrl,
    listenUrl: show.listenUrl,
    defaultCta: show.defaultCta,
    vocabulary: show.vocabulary,
  };
}

/**
 * POST /api/show — onboarding step 1: create the show (and workspace if the
 * Clerk webhook has not landed yet). Idempotent: if a show already exists it
 * is returned unchanged so a refresh cannot duplicate it.
 */
export async function handleShowPost(userId: string, raw: unknown): Promise<ApiResult> {
  if (!isDbConfigured()) {
    return { status: 503, json: { error: SAVE_UNAVAILABLE_COPY } };
  }
  const parsed = showCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, json: { error: firstErrorMessage(parsed.error) } };
  }
  const existing = await queries.getShowByOwner(userId);
  if (existing) {
    return { status: 200, json: { created: false, show: serializeShow(existing) } };
  }
  const workspace = await queries.getOrCreateWorkspaceByOwner(userId);
  const show = await queries.createShow(workspace.id, {
    name: parsed.data.name,
    rssUrl: parsed.data.rssUrl,
    artworkUrl: parsed.data.artworkUrl,
  });
  return { status: 201, json: { created: true, show: serializeShow(show) } };
}

/**
 * PATCH /api/show — settings General (M9): name, artwork URL, listen link,
 * default CTA, vocabulary terms. Only the sent fields change.
 */
export async function handleShowPatch(userId: string, raw: unknown): Promise<ApiResult> {
  if (!isDbConfigured()) {
    return { status: 503, json: { error: SAVE_UNAVAILABLE_COPY } };
  }
  const parsed = showPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, json: { error: firstErrorMessage(parsed.error) } };
  }
  const existing = await queries.getShowByOwner(userId);
  if (!existing) {
    return { status: 404, json: { error: NO_SHOW_COPY } };
  }
  const patch = parsed.data;
  const updates: Parameters<typeof queries.updateShow>[1] = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.rssUrl !== undefined) updates.rssUrl = patch.rssUrl ?? null;
  if (patch.artworkUrl !== undefined) updates.artworkUrl = patch.artworkUrl ?? null;
  if (patch.listenUrl !== undefined) updates.listenUrl = patch.listenUrl ?? null;
  if (patch.defaultCta !== undefined) updates.defaultCta = patch.defaultCta ?? null;
  if (patch.vocabulary !== undefined) updates.vocabulary = patch.vocabulary;
  const show = await queries.updateShow(existing.id, updates);
  return { status: 200, json: { show: serializeShow(show) } };
}
