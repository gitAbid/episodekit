/**
 * Drizzle schema — implemented exactly per docs/relaunch/03-architecture.md §7.1.
 * Enums and defaults follow the spec; where §7.1 states no default, boring
 * conventions apply (logged in DECISIONS.md): timestamps default now(), arrays
 * and counters default to empty/zero, boolean flags default false, status enums
 * have no default (every insert states one explicitly).
 */
import {
  boolean,
  char,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  numeric,
} from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan", ["free", "pro"]);
export const planSourceEnum = pgEnum("plan_source", ["ls", "manual"]);
export const workspaceStatusEnum = pgEnum("workspace_status", [
  "active",
  "past_due",
  "cancelled",
]);
export const episodeSourceEnum = pgEnum("episode_source", ["upload", "paste", "sample"]);
export const episodeStatusEnum = pgEnum("episode_status", [
  "uploading",
  "queued",
  "transcribing",
  "writing",
  "ready",
  "failed",
]);
export const artifactKindEnum = pgEnum("artifact_kind", [
  "show_notes",
  "chapters",
  "summary",
  "titles",
  "blog",
  "newsletter",
  "social",
  "quotes",
]);
export const artifactStatusEnum = pgEnum("artifact_status", [
  "pending",
  "writing",
  "ready",
  "failed",
  "fallback",
]);
export const usageKindEnum = pgEnum("usage_kind", ["asr", "llm", "free_tool"]);

export const users = pgTable("users", {
  /** Clerk user id. */
  id: text("id").primaryKey(),
  email: text("email"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: planEnum("plan").notNull().default("free"),
  planSource: planSourceEnum("plan_source"),
  founding: boolean("founding").notNull().default(false),
  lsCustomerId: text("ls_customer_id"),
  lsSubscriptionId: text("ls_subscription_id"),
  status: workspaceStatusEnum("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shows = pgTable("shows", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** One show per workspace for the MVP (§3 "teams/multiple shows" out of scope). */
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rssUrl: text("rss_url"),
  artworkUrl: text("artwork_url"),
  listenUrl: text("listen_url"),
  defaultCta: text("default_cta"),
  vocabulary: text("vocabulary").array().notNull().default([]),
  voiceProfile: jsonb("voice_profile"),
  voiceSamples: text("voice_samples").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const episodes = pgTable("episodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  showId: uuid("show_id")
    .notNull()
    .references(() => shows.id, { onDelete: "cascade" }),
  title: text("title"),
  number: integer("number"),
  guests: jsonb("guests"),
  source: episodeSourceEnum("source").notNull(),
  audioBlobPath: text("audio_blob_path"),
  durationMs: integer("duration_ms"),
  hasTimestamps: boolean("has_timestamps").notNull().default(false),
  hasSpeakers: boolean("has_speakers").notNull().default(false),
  status: episodeStatusEnum("status").notNull(),
  errorCode: text("error_code"),
  /** "2026-10" — month the episode counted against the plan quota (M10). */
  quotaMonth: char("quota_month", { length: 7 }),
  countsQuota: boolean("counts_quota").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const segments = pgTable("segments", {
  /** e.g. "seg_000123" (§7.1). */
  id: text("id").primaryKey(),
  episodeId: uuid("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  speaker: text("speaker"),
  startMs: integer("start_ms"),
  endMs: integer("end_ms"),
  text: text("text").notNull(),
});

export const analysis = pgTable("analysis", {
  episodeId: uuid("episode_id")
    .primaryKey()
    .references(() => episodes.id, { onDelete: "cascade" }),
  chapters: jsonb("chapters"),
  topics: text("topics").array(),
  /** QuoteRef[] per §7.2. */
  candidateQuotes: jsonb("candidate_quotes"),
});

export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    kind: artifactKindEnum("kind").notNull(),
    status: artifactStatusEnum("status").notNull(),
    content: jsonb("content"),
    previousContent: jsonb("previous_content"),
    readyFlag: boolean("ready_flag").notNull().default(false),
    regenCount: integer("regen_count").notNull().default(0),
    provider: text("provider"),
    model: text("model"),
    errorCode: text("error_code"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("artifacts_episode_id_kind_unique").on(t.episodeId, t.kind)],
);

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "set null" }),
  artifactKind: artifactKindEnum("artifact_kind"),
  rating: smallint("rating"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "set null" }),
  kind: usageKindEnum("kind").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  units: integer("units").notNull(),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});
