import { describe, expect, it } from "vitest";
import { parseFeed } from "@/lib/rss/parse";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title><![CDATA[The Focus Hour]]></title>
  <link>https://example.com/show</link>
  <description>Attention &amp; focus.</description>
  <itunes:image href="https://cdn.example.com/art.jpg" />
  <item>
    <title>Ep 42 · Attention is a budget</title>
  </item>
</channel>
</rss>`;

const IMAGE_BLOCK_FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Plain &amp; Simple</title>
  <image><url>https://cdn.example.com/cover.png</url><title>Art</title></image>
  <item><title>Item title</title></item>
</channel></rss>`;

describe("parseFeed", () => {
  it("extracts the channel title, not item titles", () => {
    expect(parseFeed(FEED, "https://example.com/feed.xml")).toEqual({
      name: "The Focus Hour",
      artworkUrl: "https://cdn.example.com/art.jpg",
    });
  });

  it("decodes entities and strips CDATA in the title", () => {
    const { name } = parseFeed(IMAGE_BLOCK_FEED, "https://example.com/feed.xml");
    expect(name).toBe("Plain & Simple");
  });

  it("falls back to <image><url> when itunes:image is missing", () => {
    expect(parseFeed(IMAGE_BLOCK_FEED, "https://example.com/feed.xml").artworkUrl).toBe(
      "https://cdn.example.com/cover.png",
    );
  });

  it("resolves relative artwork URLs against the feed URL", () => {
    const feed = `<rss><channel><title>T</title><itunes:image href="art.jpg"/></channel></rss>`;
    expect(parseFeed(feed, "https://example.com/podcast/feed.xml").artworkUrl).toBe(
      "https://example.com/podcast/art.jpg",
    );
  });

  it("returns nulls for a feed without title or artwork", () => {
    expect(parseFeed("<rss><channel></channel></rss>", "https://example.com/f.xml")).toEqual({
      name: null,
      artworkUrl: null,
    });
  });

  it("never reads item titles as the show name", () => {
    const feed = `<rss><channel><image><url>https://x/a.png</url></image><item><title>Wrong</title></item></channel></rss>`;
    expect(parseFeed(feed, "https://x/f.xml").name).toBeNull();
  });
});
