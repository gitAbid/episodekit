/**
 * SSRF-safe feed fetch per 03-architecture.md §7.5:
 * public hosts only (private/reserved IPs blocked, including literal IPs and
 * each redirect hop), 5 MB body cap, 5 s overall timeout.
 */
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { parseFeed } from "./parse";

export const MAX_FEED_BYTES = 5 * 1024 * 1024;
export const FEED_TIMEOUT_MS = 5_000;
export const DNS_TIMEOUT_MS = 2_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "EpisodeKit (RSS preview; +https://episodekit.com)";

export type FeedInfo = { name: string | null; artworkUrl: string | null };

/** Narrow DNS contract: only what assertPublicHost needs (easily mockable). */
export type LookupFn = (
  hostname: string,
  options: { all: true },
) => Promise<{ address: string; family: number }[]>;

export type FetchFeedDeps = {
  fetchImpl?: typeof fetch;
  lookupFn?: LookupFn;
  timeoutMs?: number;
};

function toIp(ip: string): ipaddr.IPv4 | ipaddr.IPv6 | null {
  try {
    const parsed = ipaddr.parse(ip);
    // Unwrap IPv4-mapped IPv6 so ::ffff:10.0.0.1 is judged as an IPv4 address.
    if (parsed.kind() === "ipv6" && parsed.range() === "ipv4Mapped") {
      return (parsed as ipaddr.IPv6).toIPv4Address();
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isPublicIp(ip: string): boolean {
  const parsed = toIp(ip);
  if (!parsed) return false;
  return parsed.range() === "unicast";
}

export async function assertPublicHost(
  hostname: string,
  lookupFn: LookupFn = lookup as unknown as LookupFn,
  timeoutMs = DNS_TIMEOUT_MS,
): Promise<void> {
  if (ipaddr.isValid(hostname)) {
    if (!isPublicIp(hostname)) {
      throw new Error(`Blocked non-public host: ${hostname}`);
    }
    return;
  }
  // getaddrinfo has no built-in timeout — bound it so a stalled resolver
  // cannot hang the request past the overall feed deadline.
  const addresses = await Promise.race([
    lookupFn(hostname, { all: true }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`DNS lookup timed out for ${hostname}`)), timeoutMs),
    ),
  ]);
  if (addresses.length === 0) throw new Error(`Host did not resolve: ${hostname}`);
  for (const { address } of addresses) {
    if (!isPublicIp(address)) {
      throw new Error(`Blocked non-public address for ${hostname}: ${address}`);
    }
  }
}

async function readBodyCapped(res: Response, cap: number): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > cap) {
    throw new Error(`Feed larger than ${cap} bytes`);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    if (text.length > cap) throw new Error(`Feed larger than ${cap} bytes`);
    return text;
  }
  const decoder = new TextDecoder();
  let received = 0;
  const parts: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > cap) {
      await reader.cancel();
      throw new Error(`Feed larger than ${cap} bytes`);
    }
    parts.push(decoder.decode(value, { stream: true }));
  }
  parts.push(decoder.decode());
  return parts.join("");
}

export async function fetchFeed(url: string, deps: FetchFeedDeps = {}): Promise<FeedInfo> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const lookupFn = deps.lookupFn ?? lookup;
  const timeoutMs = deps.timeoutMs ?? FEED_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsedUrl = new URL(current);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
    }
    await assertPublicHost(parsedUrl.hostname, lookupFn);
    const res = await fetchImpl(current, {
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect without location");
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Feed request failed: HTTP ${res.status}`);
    const body = await readBodyCapped(res, MAX_FEED_BYTES);
    return parseFeed(body, current);
  }
  throw new Error("Too many redirects");
}
