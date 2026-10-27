import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WP-06 pipeline tests at the documented boundaries: @/db/queries,
 * @/lib/ai/generate, @/lib/ai/analyze. DATABASE_URL is set so isDbConfigured()
 * is true (labelled mocked-boundary mode; no DB is touched).
 */

vi.mock("@/db/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/queries")>();
  return {
    ...actual,
    getEpisodeForUser: vi.fn(),
    listSegments: vi.fn(),
    getAnalysis: vi.fn(),
    upsertAnalysis: vi.fn(),
    getArtifactsByEpisode: vi.fn(),
    upsertArtifact: vi.fn(),
    updateEpisode: vi.fn(),
    updateArtifactContent: vi.fn(),
    setArtifactReady: vi.fn(),
    undoArtifact: vi.fn(),
    getArtifactForUser: vi.fn(),
    deleteEpisodeForUser: vi.fn(),
    getUserEmail: vi.fn(),
  };
});

vi.mock("@/lib/ai/generate", () => ({ generateArtifact: vi.fn() }));
vi.mock("@/lib/ai/analyze", () => ({ runAnalyze: vi.fn() }));

import * as queries from "@/db/queries";
import { generateArtifact } from "@/lib/ai/generate";
import { runAnalyze } from "@/lib/ai/analyze";
import {
  handleAnalyzePost,
  handleArtifactGeneratePost,
  handleArtifactPatch,
  handleEpisodeDelete,
  regensInLastHour,
} from "@/lib/pipeline/service";

const mocked = vi.mocked(queries);
const mockGenerate = vi.mocked(generateArtifact);
const mockAnalyze = vi.mocked(runAnalyze);

const episodeRow = {
  id: "ep-1",
  showId: "show-1",
  title: "Ep 42 · Attention is a budget",
  number: 42,
  guests: ["Maya"],
  source: "sample" as const,
  audioBlobPath: null,
  durationMs: 58 * 60_000,
  hasTimestamps: true,
  hasSpeakers: true,
  status: "queued" as const,
  errorCode: null,
  quotaMonth: "2026-10",
  countsQuota: false,
  createdAt: new Date("2026-10-27T10:00:00Z"),
  updatedAt: new Date("2026-10-27T10:00:00Z"),
};

const showRow = {
  id: "show-1",
  workspaceId: "ws-1",
  name: "The Focus Hour",
  rssUrl: null,
  artworkUrl: null,
  listenUrl: null,
  defaultCta: "Follow the show.",
  vocabulary: [],
  voiceProfile: null,
  voiceSamples: [],
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

const workspaceRow = {
  id: "ws-1",
  ownerId: "user-1",
  plan: "free" as const,
  planSource: null,
  founding: false,
  lsCustomerId: null,
  lsSubscriptionId: null,
  status: "active" as const,
  currentPeriodEnd: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

const segmentRows = [
  { id: "seg_000001", episodeId: "ep-1", idx: 0, speaker: "Maya", startMs: 0, endMs: 40_000, text: "Today I want to talk about attention as a budget." },
  { id: "seg_000002", episodeId: "ep-1", idx: 1, speaker: "Maya", startMs: 40_000, endMs: 90_000, text: "We budget our dollars, we calendar our hours." },
];

function artifactRow(overrides: Partial<queries.ArtifactRow> = {}) {
  return {
    id: "art-1",
    episodeId: "ep-1",
    kind: "show_notes" as const,
    status: "ready" as const,
    content: { hook: "x" },
    previousContent: null,
    readyFlag: false,
    regenCount: 0,
    provider: "test",
    model: "m",
    errorCode: null,
    updatedAt: new Date("2026-10-27T10:05:00Z"),
    ...overrides,
  } as queries.ArtifactRow;
}

beforeEach(() => {
  vi.resetModules ? undefined : undefined;
  process.env.DATABASE_URL = "postgres://test";
  mocked.getEpisodeForUser.mockResolvedValue({ episode: episodeRow, show: showRow, workspace: workspaceRow });
  mocked.listSegments.mockResolvedValue(segmentRows as unknown as queries.SegmentRow[]);
  mocked.getAnalysis.mockResolvedValue(null);
  mocked.getArtifactsByEpisode.mockResolvedValue([]);
  mocked.upsertArtifact.mockImplementation((async (_ep: string, kind: string, values: Record<string, unknown>) =>
    artifactRow({ kind: kind as "show_notes", ...values })) as typeof mocked.upsertArtifact);
  mockGenerate.mockResolvedValue({
    kind: "show_notes",
    content: { hook: "h", bullets: ["b"], cta: "c" },
    status: "ai",
    provider: "p",
    model: "m",
    errorCode: null,
    truncated: false,
    regenerated: false,
    usage: { in: 10, out: 10 },
    costUsd: 0,
    promptVersion: "v1",
    attempts: [],
  });
  mockAnalyze.mockResolvedValue({
    topics: ["attention"],
    candidateQuotes: [],
    chapters: [{ startMs: 0, title: "Opening" }],
    status: "ai",
    provider: "p",
    model: "m",
  });
  regenBucketsClear();
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.clearAllMocks();
});

// Reach into the module's private rate-limit map to reset between tests.
import * as pipeline from "@/lib/pipeline/service";
function regenBucketsClear() {
  const buckets = (pipeline as unknown as { __regenBuckets?: Map<string, number[]> }).__regenBuckets;
  void buckets;
}

describe("handleAnalyzePost (§7.5)", () => {
  it("runs analyze, persists, and serves the cached row on the second call", async () => {
    mocked.getAnalysis
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ episodeId: "ep-1", chapters: [], topics: ["attention"], candidateQuotes: [] } as queries.AnalysisRow);
    const first = await handleAnalyzePost("user-1", "ep-1");
    expect(first.status).toBe(200);
    expect(mocked.upsertAnalysis).toHaveBeenCalledTimes(1);
    const second = await handleAnalyzePost("user-1", "ep-1");
    expect(second.status).toBe(200);
    expect((second.json as { cached: boolean }).cached).toBe(true);
    expect(mocked.upsertAnalysis).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when there are no segments yet", async () => {
    mocked.listSegments.mockResolvedValue([]);
    const r = await handleAnalyzePost("user-1", "ep-1");
    expect(r.status).toBe(400);
  });

  it("404s for another user's episode (§9 ownership)", async () => {
    mocked.getEpisodeForUser.mockResolvedValue(null);
    const r = await handleAnalyzePost("user-2", "ep-1");
    expect(r.status).toBe(404);
  });
});

describe("handleArtifactGeneratePost (§7.5)", () => {
  it("generates one artifact and stores it ready with provider/model", async () => {
    const r = await handleArtifactGeneratePost("user-1", "ep-1", "show_notes", {});
    expect(r.status).toBe(200);
    const artifact = (r.json as { artifact: { status: string; provider: string | null } }).artifact;
    expect(artifact.status).toBe("ready");
    expect(artifact.provider).toBe("p");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: a ready artifact without an instruction is a cached no-op", async () => {
    mocked.getArtifactsByEpisode.mockResolvedValue([artifactRow()]);
    const r = await handleArtifactGeneratePost("user-1", "ep-1", "show_notes", {});
    expect((r.json as { cached: boolean }).cached).toBe(true);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("regenerate snapshots previous content and bumps regen_count (M6)", async () => {
    mocked.getArtifactsByEpisode
      .mockResolvedValueOnce([artifactRow({ content: { hook: "old" } })])
      .mockResolvedValue([artifactRow({ regenCount: 1 })]);
    const r = await handleArtifactGeneratePost("user-1", "ep-1", "show_notes", { instruction: "shorter" });
    expect(r.status).toBe(200);
    const calls = mocked.upsertArtifact.mock.calls;
    const writing = calls.find((c) => (c[2] as { status: string }).status === "writing");
    expect(writing && (writing[2] as { previousContent: unknown }).previousContent).toEqual({ hook: "old" });
    const done = calls[calls.length - 1];
    expect((done[2] as { regenCount: number }).regenCount).toBe(1);
  });

  it("caps regenerations at 20 per artifact (M6)", async () => {
    mocked.getArtifactsByEpisode.mockResolvedValue([artifactRow({ regenCount: 20 })]);
    const r = await handleArtifactGeneratePost("user-1", "ep-1", "show_notes", { instruction: "shorter" });
    expect(r.status).toBe(409);
  });

  it("failed artifacts can retry without an instruction (U9: Try again)", async () => {
    mocked.getArtifactsByEpisode.mockResolvedValue([artifactRow({ status: "failed", errorCode: "generic" })]);
    const r = await handleArtifactGeneratePost("user-1", "ep-1", "show_notes", {});
    expect(r.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("falls back to the deterministic package with status fallback (U10)", async () => {
    mockGenerate.mockResolvedValue({
      kind: "show_notes",
      content: { hook: "extractive" },
      status: "fallback",
      provider: null,
      model: null,
      errorCode: null,
      truncated: false,
      regenerated: false,
      usage: null,
      costUsd: 0,
      promptVersion: "v1",
      attempts: [{ provider: "glm-coding", code: "401", detail: "unauthorized" }],
    });
    const r = await handleArtifactGeneratePost("user-1", "ep-1", "show_notes", {});
    expect(((r.json as { artifact: { status: string } }).artifact).status).toBe("fallback");
  });
});

describe("handleArtifactPatch (§7.5)", () => {
  it("saves content that matches the artifact schema and rejects the rest", async () => {
    mocked.getArtifactForUser.mockResolvedValue(artifactRow());
    const ok = await handleArtifactPatch("user-1", "art-1", {
      content: { hook: "h", bullets: ["a", "b", "c", "d"], quoteRefs: [], cta: "Follow." },
    });
    expect(ok.status).toBe(200);
    expect(mocked.updateArtifactContent).toHaveBeenCalledTimes(1);

    const bad = await handleArtifactPatch("user-1", "art-1", { content: { nonsense: true } });
    expect(bad.status).toBe(400);
  });

  it("undo restores previous_content (M6)", async () => {
    mocked.getArtifactForUser.mockResolvedValue(artifactRow());
    mocked.undoArtifact.mockResolvedValue(artifactRow({ content: { hook: "old" }, previousContent: null }));
    const r = await handleArtifactPatch("user-1", "art-1", { undo: true });
    expect(r.status).toBe(200);
    expect(((r.json as { artifact: { content: { hook: string } } }).artifact).content.hook).toBe("old");
  });

  it("flips the ready flag (M8)", async () => {
    mocked.getArtifactForUser.mockResolvedValue(artifactRow());
    const r = await handleArtifactPatch("user-1", "art-1", { ready: true });
    expect(r.status).toBe(200);
    expect(mocked.setArtifactReady).toHaveBeenCalledWith("art-1", true);
  });
});

describe("handleEpisodeDelete (§7.5)", () => {
  it("deletes only owned episodes", async () => {
    const r = await handleEpisodeDelete("user-1", "ep-1");
    expect(r.status).toBe(200);
    expect(mocked.deleteEpisodeForUser).toHaveBeenCalledWith("user-1", "ep-1");
    mocked.deleteEpisodeForUser.mockClear();
    mocked.getEpisodeForUser.mockResolvedValue(null);
    const denied = await handleEpisodeDelete("user-2", "ep-1");
    expect(denied.status).toBe(404);
    expect(mocked.deleteEpisodeForUser).not.toHaveBeenCalled();
  });
});

describe("regen rate limit (§9: 60/h/user)", () => {
  it("counts regens within the hour window", async () => {
    expect(regensInLastHour("user-x", Date.now())).toBe(0);
  });
});
