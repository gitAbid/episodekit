import { RSS_ERROR_COPY } from "@/lib/copy";
import { fetchFeed } from "./fetch-feed";
import { rssPreviewSchema } from "@/lib/show/input";

export type ApiResult = { status: number; json: Record<string, unknown> };

export type RssPreviewDeps = {
  fetchFeedImpl?: typeof fetchFeed;
};

/**
 * POST /api/rss/preview logic (U2): fetch the feed SSRF-safely and return the
 * show name + artwork for prefill. Any failure maps to one honest message.
 */
export async function handleRssPreview(
  raw: unknown,
  deps: RssPreviewDeps = {},
): Promise<ApiResult> {
  const parsed = rssPreviewSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, json: { error: RSS_ERROR_COPY } };
  }
  try {
    const feed = await (deps.fetchFeedImpl ?? fetchFeed)(parsed.data.url);
    if (feed.name === null && feed.artworkUrl === null) {
      return { status: 400, json: { error: RSS_ERROR_COPY } };
    }
    return {
      status: 200,
      json: { name: feed.name, artworkUrl: feed.artworkUrl },
    };
  } catch {
    return { status: 400, json: { error: RSS_ERROR_COPY } };
  }
}
