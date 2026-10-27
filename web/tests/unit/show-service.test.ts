import { afterEach, describe, expect, it, vi } from "vitest";
import { handleShowPatch, handleShowPost } from "@/lib/show/service";
import { SAVE_UNAVAILABLE_COPY } from "@/lib/copy";

vi.mock("@/db/queries", () => ({
  getShowByOwner: vi.fn(),
  getOrCreateWorkspaceByOwner: vi.fn(),
  createShow: vi.fn(),
  updateShow: vi.fn(),
}));

import * as queries from "@/db/queries";

const mocked = vi.mocked(queries);

const showRow = {
  id: "show-1",
  workspaceId: "ws-1",
  name: "The Focus Hour",
  rssUrl: "https://example.com/feed.xml",
  artworkUrl: "https://cdn.example.com/art.jpg",
  listenUrl: null,
  defaultCta: null,
  vocabulary: ["attention"],
  voiceProfile: null,
  voiceSamples: [],
  createdAt: new Date(),
};

afterEach(() => {
  delete process.env.DATABASE_URL;
  vi.clearAllMocks();
});

describe("handleShowPost (onboarding step 1)", () => {
  it("returns 503 with preview copy when the DB is not configured", async () => {
    const result = await handleShowPost("u1", { name: "Show" });
    expect(result.status).toBe(503);
    expect(result.json).toEqual({ error: SAVE_UNAVAILABLE_COPY });
    expect(mocked.getShowByOwner).not.toHaveBeenCalled();
  });

  it("validates the body and reports the first problem", async () => {
    process.env.DATABASE_URL = "postgres://test";
    expect((await handleShowPost("u1", {})).json).toEqual({ error: "Enter your show name." });
    expect((await handleShowPost("u1", { name: "S", rssUrl: "not a url" })).json).toEqual({
      error: "Enter a valid URL.",
    });
  });

  it("creates the workspace and show, returning 201", async () => {
    process.env.DATABASE_URL = "postgres://test";
    mocked.getShowByOwner.mockResolvedValue(null);
    mocked.getOrCreateWorkspaceByOwner.mockResolvedValue({
      id: "ws-1",
      ownerId: "u1",
      plan: "free",
      planSource: null,
      founding: false,
      lsCustomerId: null,
      lsSubscriptionId: null,
      status: "active",
      currentPeriodEnd: null,
      createdAt: new Date(),
    });
    mocked.createShow.mockResolvedValue(showRow);

    const result = await handleShowPost("u1", {
      name: "  The Focus Hour  ",
      rssUrl: "https://example.com/feed.xml",
      artworkUrl: "https://cdn.example.com/art.jpg",
    });

    expect(result.status).toBe(201);
    expect(result.json).toEqual({ created: true, show: expect.objectContaining({ name: "The Focus Hour" }) });
    expect(mocked.getOrCreateWorkspaceByOwner).toHaveBeenCalledWith("u1");
    expect(mocked.createShow).toHaveBeenCalledWith("ws-1", {
      name: "The Focus Hour",
      rssUrl: "https://example.com/feed.xml",
      artworkUrl: "https://cdn.example.com/art.jpg",
    });
  });

  it("returns the existing show instead of duplicating (idempotent refresh)", async () => {
    process.env.DATABASE_URL = "postgres://test";
    mocked.getShowByOwner.mockResolvedValue(showRow);
    const result = await handleShowPost("u1", { name: "Another" });
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ created: false, show: expect.any(Object) });
    expect(mocked.createShow).not.toHaveBeenCalled();
  });
});

describe("handleShowPatch (settings General)", () => {
  it("returns 404 when the user has no show yet", async () => {
    process.env.DATABASE_URL = "postgres://test";
    mocked.getShowByOwner.mockResolvedValue(null);
    const result = await handleShowPatch("u1", { name: "New name" });
    expect(result.status).toBe(404);
  });

  it("maps General settings fields and returns the updated show", async () => {
    process.env.DATABASE_URL = "postgres://test";
    mocked.getShowByOwner.mockResolvedValue(showRow);
    mocked.updateShow.mockResolvedValue({
      ...showRow,
      name: "Renamed",
      listenUrl: "https://podcasts.apple.com/x",
      defaultCta: "Follow the show.",
      vocabulary: ["attention", "glmwfi"],
    });

    const result = await handleShowPatch("u1", {
      name: "Renamed",
      listenUrl: "https://podcasts.apple.com/x",
      defaultCta: "Follow the show.",
      vocabulary: ["attention", "glmwfi"],
    });

    expect(result.status).toBe(200);
    expect(mocked.updateShow).toHaveBeenCalledWith("show-1", {
      name: "Renamed",
      listenUrl: "https://podcasts.apple.com/x",
      defaultCta: "Follow the show.",
      vocabulary: ["attention", "glmwfi"],
    });
    expect(result.json).toEqual({
      show: expect.objectContaining({ name: "Renamed", vocabulary: ["attention", "glmwfi"] }),
    });
  });

  it("keeps fields that are not sent", async () => {
    process.env.DATABASE_URL = "postgres://test";
    mocked.getShowByOwner.mockResolvedValue(showRow);
    mocked.updateShow.mockResolvedValue(showRow);
    await handleShowPatch("u1", { defaultCta: "Follow." });
    expect(mocked.updateShow).toHaveBeenCalledWith("show-1", { defaultCta: "Follow." });
  });
});
