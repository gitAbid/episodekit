import { describe, expect, it } from "vitest";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import * as s from "@/db/schema";

type Col = ReturnType<typeof getTableConfig<PgTable>>["columns"][number];

function cols(table: PgTable): Record<string, Col> {
  const { columns } = getTableConfig(table);
  return Object.fromEntries(columns.map((c) => [c.name, c]));
}

function referencedTables(table: PgTable): { table: string; onDelete: string }[] {
  return getTableConfig(table).foreignKeys.map((f) => {
    const ref = f.reference() as unknown as { foreignTable: object };
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      table: (ref.foreignTable as any)[Symbol.for("drizzle:Name")] as string,
      onDelete: (f as unknown as { onDelete: string }).onDelete,
    };
  });
}

const TABLES: PgTable[] = [
  s.users,
  s.workspaces,
  s.shows,
  s.episodes,
  s.segments,
  s.analysis,
  s.artifacts,
  s.feedback,
  s.usageEvents,
  s.appSettings,
  s.webhookEvents,
];

function tableNames(): string[] {
  return TABLES.map((t) => getTableConfig(t).name).sort();
}

describe("schema §7.1 tables", () => {
  it("defines exactly the §7.1 tables", () => {
    expect(tableNames()).toEqual(
      [
        "analysis",
        "app_settings",
        "artifacts",
        "episodes",
        "feedback",
        "segments",
        "shows",
        "usage_events",
        "users",
        "webhook_events",
        "workspaces",
      ].sort(),
    );
  });

  it("users: text pk (= Clerk id), email, name, created_at", () => {
    const c = cols(s.users);
    expect(c.id.columnType).toBe("PgText");
    expect(c.id.primary).toBe(true);
    expect(c.email.columnType).toBe("PgText");
    expect(c.name.columnType).toBe("PgText");
    expect(c.created_at.columnType).toBe("PgTimestamp");
    expect(c.created_at.notNull).toBe(true);
    expect(c.created_at.hasDefault).toBe(true);
  });

  it("workspaces: uuid pk, owner required, plan defaults free, plan_source nullable enum", () => {
    const c = cols(s.workspaces);
    expect(c.id.columnType).toBe("PgUUID");
    expect(c.id.primary).toBe(true);
    expect(c.id.hasDefault).toBe(true);
    expect(c.owner_id.notNull).toBe(true);
    expect(c.plan.enumValues).toEqual(["free", "pro"]);
    expect(c.plan.hasDefault).toBe(true);
    expect(c.plan.default).toBe("free");
    expect(c.plan_source.enumValues).toEqual(["ls", "manual"]);
    expect(c.plan_source.notNull).toBe(false);
    expect(c.founding.columnType).toBe("PgBoolean");
    expect(c.status.enumValues).toEqual(["active", "past_due", "cancelled"]);
    expect(c.current_period_end.notNull).toBe(false);
    expect(c.created_at.notNull).toBe(true);
  });

  it("shows: workspace_id unique, optional feed fields, text arrays, jsonb voice fields", () => {
    const c = cols(s.shows);
    expect(c.workspace_id.notNull).toBe(true);
    expect(c.workspace_id.isUnique).toBe(true);
    expect(c.name.notNull).toBe(true);
    expect(c.rss_url.notNull).toBe(false);
    expect(c.artwork_url.notNull).toBe(false);
    expect(c.listen_url.notNull).toBe(false);
    expect(c.default_cta.notNull).toBe(false);
    expect(c.vocabulary.columnType).toBe("PgArray");
    expect(c.voice_profile.columnType).toBe("PgJsonb");
    expect(c.voice_samples.columnType).toBe("PgArray");
  });

  it("episodes: source and status enums, quota_month char(7)", () => {
    const c = cols(s.episodes);
    expect(c.source.enumValues).toEqual(["upload", "paste", "sample"]);
    expect(c.status.enumValues).toEqual([
      "uploading",
      "queued",
      "transcribing",
      "writing",
      "ready",
      "failed",
    ]);
    expect(c.quota_month.columnType).toBe("PgChar");
    expect((c.quota_month as unknown as { length: number }).length).toBe(7);
    expect(c.has_timestamps.columnType).toBe("PgBoolean");
    expect(c.has_speakers.columnType).toBe("PgBoolean");
    expect(c.counts_quota.columnType).toBe("PgBoolean");
    expect(c.error_code.notNull).toBe(false);
    expect(c.updated_at.notNull).toBe(true);
  });

  it("segments: text id, nullable speaker and timestamps, required text and idx", () => {
    const c = cols(s.segments);
    expect(c.id.columnType).toBe("PgText");
    expect(c.id.primary).toBe(true);
    expect(c.speaker.notNull).toBe(false);
    expect(c.start_ms.notNull).toBe(false);
    expect(c.end_ms.notNull).toBe(false);
    expect(c.text.notNull).toBe(true);
    expect(c.idx.notNull).toBe(true);
  });

  it("analysis: episode_id is the primary key", () => {
    const c = cols(s.analysis);
    expect(c.episode_id.primary).toBe(true);
    expect(c.chapters.columnType).toBe("PgJsonb");
    expect(c.topics.columnType).toBe("PgArray");
    expect(c.candidate_quotes.columnType).toBe("PgJsonb");
  });

  it("artifacts: kind and status enums, unique (episode_id, kind)", () => {
    const c = cols(s.artifacts);
    expect(c.kind.enumValues).toEqual([
      "show_notes",
      "chapters",
      "summary",
      "titles",
      "blog",
      "newsletter",
      "social",
      "quotes",
    ]);
    expect(c.status.enumValues).toEqual(["pending", "writing", "ready", "failed", "fallback"]);
    expect(c.previous_content.notNull).toBe(false);
    expect(c.ready_flag.columnType).toBe("PgBoolean");
    expect(c.regen_count.columnType).toBe("PgInteger");
    expect(c.error_code.notNull).toBe(false);
    const { uniqueConstraints } = getTableConfig(s.artifacts);
    expect(uniqueConstraints).toHaveLength(1);
    expect(uniqueConstraints[0].columns.map((x) => x.name)).toEqual(["episode_id", "kind"]);
  });

  it("feedback: nullable user/episode/kind/rating", () => {
    const c = cols(s.feedback);
    expect(c.user_id.notNull).toBe(false);
    expect(c.episode_id.notNull).toBe(false);
    expect(c.artifact_kind.enumValues).toEqual([
      "show_notes",
      "chapters",
      "summary",
      "titles",
      "blog",
      "newsletter",
      "social",
      "quotes",
    ]);
    expect(c.artifact_kind.notNull).toBe(false);
    expect(c.rating.columnType).toBe("PgSmallInt");
    expect(c.rating.notNull).toBe(false);
    expect(c.note.columnType).toBe("PgText");
  });

  it("usage_events: kind enum(asr|llm|free_tool), units int, cost numeric", () => {
    const c = cols(s.usageEvents);
    expect(c.kind.enumValues).toEqual(["asr", "llm", "free_tool"]);
    expect(c.units.columnType).toBe("PgInteger");
    expect(c.cost_usd.columnType).toBe("PgNumeric");
  });

  it("app_settings: key text pk + jsonb value; webhook_events: text id pk", () => {
    const a = cols(s.appSettings);
    expect(a.key.columnType).toBe("PgText");
    expect(a.key.primary).toBe(true);
    expect(a.value.columnType).toBe("PgJsonb");
    const w = cols(s.webhookEvents);
    expect(w.id.primary).toBe(true);
    expect(w.provider.columnType).toBe("PgText");
    expect(w.processed_at.notNull).toBe(true);
  });

  it("deletes cascade from users down to owned data; feedback and usage survive", () => {
    expect(referencedTables(s.workspaces)).toEqual([{ table: "users", onDelete: "cascade" }]);
    expect(referencedTables(s.shows)).toEqual([{ table: "workspaces", onDelete: "cascade" }]);
    expect(referencedTables(s.episodes)).toEqual([{ table: "shows", onDelete: "cascade" }]);
    expect(referencedTables(s.segments)).toEqual([{ table: "episodes", onDelete: "cascade" }]);
    expect(referencedTables(s.analysis)).toEqual([{ table: "episodes", onDelete: "cascade" }]);
    expect(referencedTables(s.artifacts)).toEqual([{ table: "episodes", onDelete: "cascade" }]);
    expect(referencedTables(s.feedback)).toEqual([
      { table: "users", onDelete: "set null" },
      { table: "episodes", onDelete: "set null" },
    ]);
    expect(referencedTables(s.usageEvents).map((r) => r.table).sort()).toEqual([
      "episodes",
      "workspaces",
    ]);
  });
});
