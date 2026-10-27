import { desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { feedback, shows, users, webhookEvents, workspaces } from "./schema";

export type ShowRow = typeof shows.$inferSelect;
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type UserRow = typeof users.$inferSelect;

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

// ---- feedback (M11 / WP-09) --------------------------------------------------

export async function insertFeedback(row: {
  userId: string | null;
  episodeId: string | null;
  artifactKind: string | null;
  rating: number | null;
  note: string | null;
}): Promise<void> {
  const db = getDb();
  await db.insert(feedback).values({
    userId: row.userId,
    episodeId: row.episodeId,
    // validated upstream against the enum values before reaching this boundary
    artifactKind: row.artifactKind as typeof feedback.$inferInsert.artifactKind,
    rating: row.rating,
    note: row.note,
  });
}

export type FeedbackListRow = {
  id: string;
  artifactKind: string | null;
  rating: number | null;
  note: string | null;
  createdAt: Date;
};

export async function listFeedback(limit = 50): Promise<FeedbackListRow[]> {
  const db = getDb();
  return db
    .select({
      id: feedback.id,
      artifactKind: feedback.artifactKind,
      rating: feedback.rating,
      note: feedback.note,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .orderBy(desc(feedback.createdAt))
    .limit(limit);
}
