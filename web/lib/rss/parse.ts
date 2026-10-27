/**
 * Minimal RSS field extraction for onboarding prefill (U2).
 * We only need the channel-level name and artwork — full feed parsing is out of
 * MVP scope (RSS episode import is explicitly NOT in MVP). No XML dependency.
 */
const CDATA_RE = /<!\[CDATA\[([\s\S]*?)\]\]>/;

export function stripCdata(raw: string): string {
  return raw.replace(CDATA_RE, "$1").trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

export function decodeXmlEntities(raw: string): string {
  return raw.replace(/&#(\d+);|&#x([0-9a-fA-F]+);|&(\w+);/g, (whole, dec, hex, name) => {
    if (dec) return String.fromCodePoint(Number.parseInt(dec, 10));
    if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
    const named = NAMED_ENTITIES[name];
    return named ?? whole;
  });
}

function decode(raw: string): string {
  return decodeXmlEntities(stripCdata(raw)).trim();
}

/** Channel-level slice: everything before the first <item> (or the whole doc). */
function channelBlock(xml: string): string {
  const itemAt = xml.search(/<item[\s>]/i);
  return itemAt === -1 ? xml : xml.slice(0, itemAt);
}

export function parseFeedTitle(xml: string): string | null {
  const block = channelBlock(xml);
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(block);
  if (!match) return null;
  const title = decode(match[1]);
  return title.length > 0 ? title : null;
}

export function parseFeedArtwork(xml: string, baseUrl: string): string | null {
  const block = channelBlock(xml);
  const itunes = /<itunes:image\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i.exec(block);
  const raw =
    itunes?.[1] ??
    /<image\b[^>]*>[\s\S]*?<url\b[^>]*>([\s\S]*?)<\/url>[\s\S]*?<\/image>/i.exec(block)?.[1] ??
    null;
  if (!raw) return null;
  const value = decode(raw);
  if (value.length === 0) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

export function parseFeed(xml: string, baseUrl: string): { name: string | null; artworkUrl: string | null } {
  return {
    name: parseFeedTitle(xml),
    artworkUrl: parseFeedArtwork(xml, baseUrl),
  };
}
