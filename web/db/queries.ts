import { and, count, eq } from "drizzle-orm";
import { getDb } from "./index";
import {
  episodes,
  segments,
  shows,
  users,
  webhookEvents,
  workspaces,
} from "./schema";

export type ShowRow = typeof shows.$inferSelect;
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type EpisodeRow = typeof episodes.$inferSelect;
export type SegmentRow = typeof segments.$inferSelect;

// ---------------------------------------------------------------------------
// Episodes + segments (WP-05, additive — WP-02 functions above are untouched).
// ---------------------------------------------------------------------------

export async function createEpisode(
  values: typeof episodes.$inferInsert,
): Promise<EpisodeRow> {
  const db = getDb();
  const inserted = await db.insert(episodes).values(values).returning();
  return inserted[0];
}

/** Ownership check per §9: the episode must belong to a show in the caller's workspace. */
export async function getEpisodeForUser(
  userId: string,
  episodeId: string,
): Promise<{ episode: EpisodeRow; show: ShowRow; workspace: WorkspaceRow } | null> {
  const db = getDb();
  const rows = await db
    .select({ episode: episodes, show: shows, workspace: workspaces })
    .from(episodes)
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .innerJoin(workspaces, eq(shows.workspaceId, workspaces.id))
    .where(and(eq(episodes.id, episodeId), eq(workspaces.ownerId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateEpisode(
  episodeId: string,
  values: Partial<typeof episodes.$inferInsert>,
): Promise<EpisodeRow> {
  const db = getDb();
  const updated = await db
    .update(episodes)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(episodes.id, episodeId))
    .returning();
  return updated[0];
}

/** Replaces the episode's segments (atomic delete+insert via Neon batch —
 * the neon-http driver has no interactive transactions). */
export async function replaceSegments(
  episodeId: string,
  rows: Array<Omit<typeof segments.$inferInsert, "episodeId">>,
): Promise<SegmentRow[]> {
  const db = getDb();
  if (!rows.length) {
    await db.delete(segments).where(eq(segments.episodeId, episodeId));
    return [];
  }
  const result = await db.batch([
    db.delete(segments).where(eq(segments.episodeId, episodeId)),
    db.insert(segments).values(rows.map((r) => ({ ...r, episodeId }))).returning(),
  ] as const);
  return result[1];
}

export async function listSegments(episodeId: string): Promise<SegmentRow[]> {
  const db = getDb();
  return db.select().from(segments).where(eq(segments.episodeId, episodeId));
}

/** Episodes created in `month` that count against the plan quota (M10). */
export async function countQuotaEpisodes(
  workspaceId: string,
  month: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: episodes.id })
    .from(episodes)
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .where(and(eq(shows.workspaceId, workspaceId), eq(episodes.quotaMonth, month), eq(episodes.countsQuota, true)));
  return rows.length;
}

export async function upsertUser(input: {
  id: string;
  email: string | null;
  name: string | null;
}): Promise<void> {
  const db = getDb();
  await db
    .insert(users)
    .values(input)
    .onConflictDoUpdate({ target: users.id, set: { email: input.email, name: input.name } });
}

export async function getWorkspaceByOwner(ownerId: string): Promise<WorkspaceRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, ownerId))
    .limit(1);
  return rows[0] ?? null;
}

/** Idempotent: the workspace(plan=free) must exist for every user (U1). */
export async function getOrCreateWorkspaceByOwner(ownerId: string): Promise<WorkspaceRow> {
  const existing = await getWorkspaceByOwner(ownerId);
  if (existing) return existing;
  const db = getDb();
  const inserted = await db.insert(workspaces).values({ ownerId }).returning();
  return inserted[0];
}

export async function getShowByOwner(ownerId: string): Promise<ShowRow | null> {
  const db = getDb();
  const rows = await db
    .select({ show: shows })
    .from(shows)
    .innerJoin(workspaces, eq(shows.workspaceId, workspaces.id))
    .where(eq(workspaces.ownerId, ownerId))
    .limit(1);
  return rows[0]?.show ?? null;
}

export async function createShow(
  workspaceId: string,
  values: { name: string; rssUrl?: string; artworkUrl?: string },
): Promise<ShowRow> {
  const db = getDb();
  const inserted = await db
    .insert(shows)
    .values({ workspaceId, ...values })
    .returning();
  return inserted[0];
}

export async function updateShow(
  showId: string,
  values: Partial<{
    name: string;
    rssUrl: string | null;
    artworkUrl: string | null;
    listenUrl: string | null;
    defaultCta: string | null;
    vocabulary: string[];
  }>,
): Promise<ShowRow> {
  const db = getDb();
  const updated = await db.update(shows).set(values).where(eq(shows.id, showId)).returning();
  return updated[0];
}

export async function deleteClerkUser(id: string): Promise<void> {
  const db = getDb();
  await db.delete(users).where(eq(users.id, id));
}

export async function isWebhookEventProcessed(id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(eq(webhookEvents.id, id))
    .limit(1);
  return rows.length > 0;
}

export async function markWebhookEventProcessed(id: string, provider: string): Promise<void> {
  const db = getDb();
  await db.insert(webhookEvents).values({ id, provider }).onConflictDoNothing();
}

/**
 * Billing (WP-08) workspace updates. `undefined` values leave the column
 * unchanged; an explicit `null` clears it. Never fakes values: the caller
 * decides every field (webhook mapping, manual owner flag).
 */
export type WorkspacePlanUpdate = Partial<{
  plan: "free" | "pro";
  planSource: "ls" | "manual" | null;
  founding: boolean;
  status: "active" | "past_due" | "cancelled";
  currentPeriodEnd: Date | null;
  lsCustomerId: string | null;
  lsSubscriptionId: string | null;
}>;

export async function updateWorkspacePlan(
  workspaceId: string,
  update: WorkspacePlanUpdate,
): Promise<WorkspaceRow> {
  const db = getDb();
  const set = Object.fromEntries(
    Object.entries(update).filter(([, v]) => v !== undefined),
  );
  const updated = await db
    .update(workspaces)
    .set(set)
    .where(eq(workspaces.id, workspaceId))
    .returning();
  return updated[0];
}

export async function getWorkspaceById(id: string): Promise<WorkspaceRow | null> {
  const db = getDb();
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Webhook fallback attribution when the checkout carried no workspace_id. */
export async function getWorkspaceByOwnerEmail(email: string): Promise<WorkspaceRow | null> {
  const db = getDb();
  const rows = await db
    .select({ workspace: workspaces })
    .from(users)
    .innerJoin(workspaces, eq(workspaces.ownerId, users.id))
    .where(eq(users.email, email))
    .limit(1);
  return rows[0]?.workspace ?? null;
}

/** Founding counter — always derived (first 100, M10); never stored/faked. */
export async function countFoundingWorkspaces(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ value: count() })
    .from(workspaces)
    .where(eq(workspaces.founding, true));
  return rows[0]?.value ?? 0;
}

/** Episodes that count against the workspace quota in the given month (M10). */
export async function countQuotaEpisodes(workspaceId: string, month: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ value: count() })
    .from(episodes)
    .innerJoin(shows, eq(episodes.showId, shows.id))
    .where(
      and(
        eq(shows.workspaceId, workspaceId),
        eq(episodes.quotaMonth, month),
        eq(episodes.countsQuota, true),
      ),
    );
  return rows[0]?.value ?? 0;
}

/** Counted when generation starts (M10): stamp the month and flip the flag. */
export async function markEpisodeQuotaCounted(episodeId: string, month: string): Promise<void> {
  const db = getDb();
  await db
    .update(episodes)
    .set({ quotaMonth: month, countsQuota: true, updatedAt: new Date() })
    .where(eq(episodes.id, episodeId));
}

/** Refunded on pipeline failure (M10): keep quota_month for audit, stop counting. */
export async function refundEpisodeQuota(episodeId: string): Promise<void> {
  const db = getDb();
  await db
    .update(episodes)
    .set({ countsQuota: false, updatedAt: new Date() })
    .where(eq(episodes.id, episodeId));
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.email ?? null;
}
