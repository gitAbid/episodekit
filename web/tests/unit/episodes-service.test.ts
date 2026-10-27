import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WP-05 route-handler tests at the documented boundaries:
 * @/db/queries (WP-02 seam), @/lib/blob, @/lib/asr/groq. DB is "configured"
 * via DATABASE_URL in these tests (labelled: mocked boundary mode, not a
 * faked quota success — the entitlements stub counts what the mocked
 * countQuotaEpisodes returns).
 */
vi.mock("@/db/queries", () => ({
  getShowByOwner: vi.fn(),
  getOrCreateWorkspaceByOwner: vi.fn(),
  getWorkspaceById: vi.fn(),
  getWorkspaceByOwnerEmail: vi.fn(),
  updateWorkspacePlan: vi.fn(),
  markEpisodeQuotaCounted: vi.fn(),
  refundEpisodeQuota: vi.fn(),
  countFoundingWorkspaces: vi.fn(),
  getUserEmail: vi.fn(),
  createEpisode: vi.fn(),
  getEpisodeForUser: vi.fn(),
  updateEpisode: vi.fn(),
  replaceSegments: vi.fn(),
  countQuotaEpisodes: vi.fn(),
}));

vi.mock("@/lib/asr/groq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/asr/groq")>();
  return { ...actual, transcribeWithGroq: vi.fn() };
});

vi.mock("@/lib/blob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/blob")>();
  return {
    ...actual,
    issueAudioUrl: vi.fn(),
    handleClientUpload: vi.fn(),
  };
});

import * as queries from "@/db/queries";
import { AsrError, transcribeWithGroq } from "@/lib/asr/groq";
import { handleClientUpload, issueAudioUrl } from "@/lib/blob";
import {
  UNSUPPORTED_LANGUAGE_COPY,
  NO_SPEECH_COPY,
  SAVE_UNAVAILABLE_COPY,
  UPLOAD_AUDIO_FIRST_COPY,
} from "@/lib/copy";
import {
  handleAudioGet,
  handleEpisodeGet,
  handleEpisodesPost,
  handleTranscribePost,
  handleUploadsTokenPost,
  mapAsrErrorCode,
} from "@/lib/episodes/service";

const mocked = vi.mocked(queries);
const mockTranscribe = vi.mocked(transcribeWithGroq);
const mockIssueAudioUrl = vi.mocked(issueAudioUrl);
const mockHandleUpload = vi.mocked(handleClientUpload);

const showRow = {
  id: "show-1",
  workspaceId: "ws-1",
  name: "The Focus Hour",
  rssUrl: null,
  artworkUrl: null,
  listenUrl: null,
  defaultCta: null,
  vocabulary: ["attention"],
  voiceProfile: null,
  voiceSamples: [],
  createdAt: new Date(),
};
const workspaceRow = {
  id: "ws-1",
  ownerId: "u1",
  plan: "free" as const,
  planSource: null,
  founding: false,
  lsCustomerId: null,
  lsSubscriptionId: null,
  status: "active" as const,
  currentPeriodEnd: null,
  createdAt: new Date(),
};
const episodeRow = (overrides: Partial<queries.EpisodeRow> = {}): queries.EpisodeRow => ({
  id: "ep-1",
  showId: "show-1",
  title: null,
  number: null,
  guests: null,
  source: "upload",
  audioBlobPath: null,
  durationMs: null,
  hasTimestamps: false,
  hasSpeakers: false,
  status: "uploading",
  errorCode: null,
  quotaMonth: "2026-10",
  countsQuota: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test";
  process.env.BLOB_READ_WRITE_TOKEN = "blob_test";
  mocked.getShowByOwner.mockResolvedValue(showRow);
  mocked.getOrCreateWorkspaceByOwner.mockResolvedValue(workspaceRow);
  mocked.countQuotaEpisodes.mockResolvedValue(0);
  mocked.createEpisode.mockImplementation(async (values) => episodeRow({ id: "ep-new", ...values }));
  mocked.updateEpisode.mockImplementation(async (_id, values) =>
    episodeRow({ ...values } as Partial<queries.EpisodeRow>),
  );
});

afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  vi.clearAllMocks();
});

describe("handleEpisodesPost — create (§7.5)", () => {
  it("returns 503 in keyless preview (no DATABASE_URL)", async () => {
    delete process.env.DATABASE_URL;
    const result = await handleEpisodesPost("u1", { source: "paste", transcriptText: "Hi." });
    expect(result.status).toBe(503);
    expect(result.json).toEqual({ error: SAVE_UNAVAILABLE_COPY });
  });

  it("creates a paste episode, parsing speakers + timestamps into segments", async () => {
    const riverside = [
      "Maya (00:00:00): Welcome back to the show.",
      "Dev (00:00:12): Glad to be here.",
    ].join("\n");
    mocked.createEpisode.mockResolvedValue(episodeRow({ id: "ep-paste", status: "queued" }));

    const result = await handleEpisodesPost("u1", { source: "paste", transcriptText: riverside });

    expect(result.status).toBe(201);
    expect(result.json).toEqual({ id: "ep-paste", status: "queued" });
    expect(mocked.createEpisode).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "paste",
        status: "queued",
        hasTimestamps: true,
        hasSpeakers: true,
        countsQuota: true,
        quotaMonth: expect.stringMatching(/^\d{4}-\d{2}$/),
      }),
    );
    const segments = mocked.replaceSegments.mock.calls[0][1];
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ id: "seg_ep-paste_000000", speaker: "Maya", startMs: 0 });
    expect(segments[1]).toMatchObject({ id: "seg_ep-paste_000001", speaker: "Dev", startMs: 12_000 });
  });

  it("sample episodes never count against quota (M2)", async () => {
    mocked.createEpisode.mockResolvedValue(episodeRow({ id: "ep-sample", status: "queued" }));
    const result = await handleEpisodesPost("u1", {
      source: "sample",
      transcriptText: "A perfectly ordinary English transcript about focus and attention. ".repeat(3),
    });
    expect(result.status).toBe(201);
    expect(mocked.createEpisode).toHaveBeenCalledWith(
      expect.objectContaining({ source: "sample", countsQuota: false, quotaMonth: null }),
    );
    expect(mocked.countQuotaEpisodes).not.toHaveBeenCalled();
  });

  it("returns 402 with the §6 quota-wall copy when over quota", async () => {
    mocked.countQuotaEpisodes.mockResolvedValue(2); // free limit
    const result = await handleEpisodesPost("u1", { source: "paste", transcriptText: "Hello there. " });
    expect(result.status).toBe(402);
    expect(result.json).toEqual({
      errorCode: "quota_exceeded",
      error: "You've used 2 of 2 episodes this month. Upgrade for more, or wait until Nov 1.",
    });
    expect(mocked.createEpisode).not.toHaveBeenCalled();
  });

  it("rejects non-English paste with the exact U19 copy and creates nothing", async () => {
    const result = await handleEpisodesPost("u1", {
      source: "paste",
      transcriptText: "これは日本語のテキストです。文字化けではなく、意図的に日本語で書かれています。",
    });
    expect(result.status).toBe(400);
    expect(result.json).toEqual({ errorCode: "unsupported_language", error: UNSUPPORTED_LANGUAGE_COPY });
    expect(mocked.createEpisode).not.toHaveBeenCalled();
  });

  it("serializes the chunk manifest from blobPaths + chunkOffsetsMs (§8.3)", async () => {
    mocked.createEpisode.mockResolvedValue(episodeRow({ id: "ep-up", status: "uploading" }));
    const result = await handleEpisodesPost("u1", {
      source: "upload",
      blobPaths: ["episodes/e/chunk-0.webm", "episodes/e/chunk-1.webm"],
      chunkOffsetsMs: [0, 598000],
      title: "Ep 42",
      number: 42,
      guests: ["Dev"],
    });
    expect(result.status).toBe(201);
    expect(mocked.createEpisode).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "upload",
        status: "uploading",
        audioBlobPath: JSON.stringify([
          { path: "episodes/e/chunk-0.webm", offsetMs: 0 },
          { path: "episodes/e/chunk-1.webm", offsetMs: 598000 },
        ]),
        title: "Ep 42",
        number: 42,
        guests: ["Dev"],
      }),
    );
  });

  it("returns 404 when the user has no show yet", async () => {
    mocked.getShowByOwner.mockResolvedValue(null);
    const result = await handleEpisodesPost("u1", { source: "paste", transcriptText: "Hi." });
    expect(result.status).toBe(404);
  });

  it("rejects an empty paste", async () => {
    const result = await handleEpisodesPost("u1", { source: "paste", transcriptText: "   " });
    expect(result.status).toBe(400);
  });
});

describe("handleTranscribePost — ASR orchestration (§8.3)", () => {
  const manifest = JSON.stringify([
    { path: "episodes/e/chunk-0.webm", offsetMs: 0 },
    { path: "episodes/e/chunk-1.webm", offsetMs: 598000 },
  ]);
  const owned = (episode: queries.EpisodeRow) => {
    mocked.getEpisodeForUser.mockResolvedValue({ episode, show: showRow, workspace: workspaceRow });
  };

  it("transitions uploading→queued→transcribing, stores merged segments, lands queued", async () => {
    owned(episodeRow({ audioBlobPath: manifest, status: "uploading" }));
    mockTranscribe.mockResolvedValue([
      { id: "seg_ep-paste_000000", idx: 0, speaker: null, startMs: 0, endMs: 4000, text: "First." },
      { id: "seg_000001", idx: 1, speaker: null, startMs: 600500, endMs: 604000, text: "Second." },
    ]);

    const result = await handleTranscribePost("u1", "ep-1", {});

    expect(result.status).toBe(200);
    expect(mockTranscribe).toHaveBeenCalledWith(
      [
        { blobPath: "episodes/e/chunk-0.webm", offsetMs: 0 },
        { blobPath: "episodes/e/chunk-1.webm", offsetMs: 598000 },
      ],
      { vocab: ["attention"] },
    );
    // two visible status transitions before the ASR call
    const statuses = mocked.updateEpisode.mock.calls.map((c) => (c[1] as { status?: string }).status);
    expect(statuses).toEqual(["queued", "transcribing", "queued"]);
    expect(mocked.replaceSegments).toHaveBeenCalledWith("ep-1", [
      expect.objectContaining({ id: "seg_ep-paste_000000", startMs: 0 }),
      expect.objectContaining({ id: "seg_000001", startMs: 600500 }),
    ]);
    expect(mocked.updateEpisode).toHaveBeenLastCalledWith("ep-1", {
      status: "queued",
      durationMs: 604000,
      hasTimestamps: true,
      hasSpeakers: false,
      errorCode: null,
    });
  });

  it("includes guest names in the ASR vocab prompt", async () => {
    owned(episodeRow({ audioBlobPath: manifest, guests: ["Dev", "Maya"] }));
    mockTranscribe.mockResolvedValue([
      { id: "seg_ep-paste_000000", idx: 0, speaker: null, startMs: 0, endMs: 1000, text: "Hi." },
    ]);
    await handleTranscribePost("u1", "ep-1", {});
    expect(mockTranscribe).toHaveBeenCalledWith(expect.anything(), { vocab: ["attention", "Dev", "Maya"] });
  });

  it("accepts the chunk manifest from the request body and persists it", async () => {
    owned(episodeRow({ audioBlobPath: null, status: "uploading" }));
    mockTranscribe.mockResolvedValue([
      { id: "seg_ep-paste_000000", idx: 0, speaker: null, startMs: 0, endMs: 1000, text: "Hi." },
    ]);
    await handleTranscribePost("u1", "ep-1", {
      chunks: [{ path: "episodes/e/chunk-0.webm", offsetMs: 0 }],
    });
    expect(mocked.updateEpisode).toHaveBeenCalledWith("ep-1", {
      status: "queued",
      audioBlobPath: JSON.stringify([{ path: "episodes/e/chunk-0.webm", offsetMs: 0 }]),
      errorCode: null,
    });
  });

  it("is idempotent while transcribing (refresh/second tab)", async () => {
    owned(episodeRow({ status: "transcribing" }));
    const result = await handleTranscribePost("u1", "ep-1", {});
    expect(result.status).toBe(200);
    expect(mockTranscribe).not.toHaveBeenCalled();
    expect(mocked.updateEpisode).not.toHaveBeenCalled();
  });

  it("maps unsupported_language to the exact U19 copy and refunds quota", async () => {
    owned(episodeRow({ audioBlobPath: manifest, status: "queued", countsQuota: true }));
    mockTranscribe.mockRejectedValue(new AsrError("unsupported_language", 422));

    const result = await handleTranscribePost("u1", "ep-1", {});

    expect(result.json).toEqual({
      episode: expect.objectContaining({ status: "failed", errorCode: "unsupported_language", countsQuota: false }),
    });
    expect(mocked.updateEpisode).toHaveBeenLastCalledWith("ep-1", {
      status: "failed",
      errorCode: "unsupported_language",
      countsQuota: false,
    });
  });

  it("maps empty transcripts to no_speech with the §6 copy", async () => {
    owned(episodeRow({ audioBlobPath: manifest, status: "queued" }));
    mockTranscribe.mockRejectedValue(new AsrError("empty_transcript", 422));
    const result = await handleTranscribePost("u1", "ep-1", {});
    expect((result.json as { episode: { errorCode: string } }).episode.errorCode).toBe("no_speech");
    expect(mapAsrErrorCode("empty_transcript")).toBe("no_speech");
  });

  it("returns 400 when there is no audio to transcribe yet", async () => {
    owned(episodeRow({ audioBlobPath: null, status: "uploading" }));
    const result = await handleTranscribePost("u1", "ep-1", {});
    expect(result.status).toBe(400);
    expect(result.json).toEqual({ error: UPLOAD_AUDIO_FIRST_COPY });
  });

  it("refuses paste episodes (nothing to transcribe)", async () => {
    owned(episodeRow({ source: "paste", status: "queued" }));
    const result = await handleTranscribePost("u1", "ep-1", {});
    expect(result.status).toBe(400);
    expect(mockTranscribe).not.toHaveBeenCalled();
  });

  it("maps provider outages to transcribe_failed", async () => {
    owned(episodeRow({ audioBlobPath: manifest, status: "queued" }));
    mockTranscribe.mockRejectedValue(new AsrError("groq_500", 502));
    const result = await handleTranscribePost("u1", "ep-1", {});
    expect((result.json as { episode: { errorCode: string } }).episode.errorCode).toBe("transcribe_failed");
  });
});

describe("handleEpisodeGet — resumable status read path (U4)", () => {
  it("returns the serialized episode", async () => {
    mocked.getEpisodeForUser.mockResolvedValue({
      episode: episodeRow({ status: "transcribing" }),
      show: showRow,
      workspace: workspaceRow,
    });
    const result = await handleEpisodeGet("u1", "ep-1");
    expect(result.status).toBe(200);
    expect(result.json).toEqual({
      episode: expect.objectContaining({ id: "ep-1", status: "transcribing" }),
    });
  });

  it("returns 404 for another user's episode (§9 ownership)", async () => {
    mocked.getEpisodeForUser.mockResolvedValue(null);
    expect((await handleEpisodeGet("u1", "ep-1")).status).toBe(404);
    expect((await handleTranscribePost("u1", "ep-1", {})).status).toBe(404);
    expect((await handleAudioGet("u1", "ep-1")).status).toBe(404);
  });
});

describe("handleAudioGet — signed playback URL (§7.5)", () => {
  it("returns a signed URL for the chunk containing t", async () => {
    mocked.getEpisodeForUser.mockResolvedValue({
      episode: episodeRow({
        audioBlobPath: JSON.stringify([
          { path: "a.webm", offsetMs: 0 },
          { path: "b.webm", offsetMs: 598000 },
        ]),
      }),
      show: showRow,
      workspace: workspaceRow,
    });
    mockIssueAudioUrl.mockResolvedValue({ url: "https://blob.example/signed", expiresAt: "2026-10-27T19:00:00Z" });

    const result = await handleAudioGet("u1", "ep-1", 600_000);

    expect(result.status).toBe(200);
    expect(mockIssueAudioUrl).toHaveBeenCalledWith("b.webm");
    expect(result.json).toEqual({
      url: "https://blob.example/signed",
      chunkOffsetMs: 598000,
      expiresAt: "2026-10-27T19:00:00Z",
    });
  });

  it("answers 503 when BLOB_READ_WRITE_TOKEN is missing (owner blocker)", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    mocked.getEpisodeForUser.mockResolvedValue({
      episode: episodeRow({ audioBlobPath: JSON.stringify([{ path: "a.webm", offsetMs: 0 }]) }),
      show: showRow,
      workspace: workspaceRow,
    });
    const result = await handleAudioGet("u1", "ep-1");
    expect(result.status).toBe(503);
  });
});

describe("handleUploadsTokenPost — §7.5", () => {
  const request = new Request("https://app.example/api/uploads/token", {
    method: "POST",
    body: JSON.stringify({}),
  });

  it("issues the blob client token within type + size constraints", async () => {
    mockHandleUpload.mockResolvedValue({ type: "blob.generate-client-token", clientToken: "tok" });
    const result = await handleUploadsTokenPost("u1", request);
    expect(result.status).toBe(200);
    expect(mockHandleUpload).toHaveBeenCalledWith(request, {
      allowedContentTypes: expect.arrayContaining(["audio/webm", "video/quicktime", "audio/mpeg"]),
      maximumSizeInBytes: 300_000_000,
    });
  });

  it("answers 503 when BLOB_READ_WRITE_TOKEN is missing", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const result = await handleUploadsTokenPost("u1", request);
    expect(result.status).toBe(503);
    expect(mockHandleUpload).not.toHaveBeenCalled();
  });

  it("returns 402 at the quota wall before issuing a token", async () => {
    mocked.countQuotaEpisodes.mockResolvedValue(2);
    const result = await handleUploadsTokenPost("u1", request);
    expect(result.status).toBe(402);
    expect(mockHandleUpload).not.toHaveBeenCalled();
  });
});

describe("error-code copy (§6)", () => {
  it("serves the verbatim U19 and no_speech copy", () => {
    expect(mapAsrErrorCode("unsupported_language")).toBe("unsupported_language");
    expect(NO_SPEECH_COPY).toBe("We couldn't hear any speech in this file. Check the audio and try again.");
    expect(UNSUPPORTED_LANGUAGE_COPY).toBe(
      "EpisodeKit works with English episodes for now. This one wasn't charged.",
    );
  });
});
