import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRssPreview } from "@/lib/rss/preview";
import { RSS_ERROR_COPY } from "@/lib/copy";

afterEach(() => {
  delete process.env.DATABASE_URL;
});

describe("handleRssPreview", () => {
  it("rejects a missing/invalid url with the exact U2 copy", async () => {
    expect(await handleRssPreview({})).toEqual({
      status: 400,
      json: { error: RSS_ERROR_COPY },
    });
    expect(await handleRssPreview({ url: 42 })).toEqual({
      status: 400,
      json: { error: RSS_ERROR_COPY },
    });
  });

  it("returns the feed name and artwork on success", async () => {
    const fetchFeedImpl = vi.fn(async () => ({
      name: "The Focus Hour",
      artworkUrl: "https://cdn.example.com/art.jpg",
    }));
    const result = await handleRssPreview(
      { url: "https://example.com/feed.xml" },
      { fetchFeedImpl },
    );
    expect(result).toEqual({
      status: 200,
      json: { name: "The Focus Hour", artworkUrl: "https://cdn.example.com/art.jpg" },
    });
    expect(fetchFeedImpl).toHaveBeenCalledWith("https://example.com/feed.xml");
  });

  it("returns the exact U2 copy when the fetch or parse fails", async () => {
    const fetchFeedImpl = vi.fn(async () => {
      throw new Error("blocked");
    });
    const result = await handleRssPreview(
      { url: "http://127.0.0.1/feed.xml" },
      { fetchFeedImpl },
    );
    expect(result).toEqual({ status: 400, json: { error: RSS_ERROR_COPY } });
  });

  it("treats a readable feed without any usable fields as unreadable", async () => {
    const fetchFeedImpl = vi.fn(async () => ({ name: null, artworkUrl: null }));
    const result = await handleRssPreview(
      { url: "https://example.com/empty.xml" },
      { fetchFeedImpl },
    );
    expect(result).toEqual({ status: 400, json: { error: RSS_ERROR_COPY } });
  });
});
