import { describe, expect, it, vi } from "vitest";
import {
  assertPublicHost,
  fetchFeed,
  isPublicIp,
  MAX_FEED_BYTES,
} from "@/lib/rss/fetch-feed";

const okLookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);

describe("isPublicIp", () => {
  it("allows public addresses", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("1.1.1.1")).toBe(true);
    expect(isPublicIp("2606:4700::1111")).toBe(true);
  });

  it("blocks loopback, private, link-local and reserved ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.1.1",
      "0.0.0.0",
      "100.64.0.1",
      "224.0.0.1",
      "::1",
      "::",
      "fc00::1",
      "fe80::1",
      "2001:db8::1",
    ]) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
  });

  it("blocks IPv4-mapped IPv6 pointing at private space", () => {
    expect(isPublicIp("::ffff:10.0.0.1")).toBe(false);
    expect(isPublicIp("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicIp("::ffff:8.8.8.8")).toBe(true);
  });
});

describe("assertPublicHost", () => {
  it("rejects literal private IPs without DNS", async () => {
    const lookup = vi.fn(async () => []);
    await expect(assertPublicHost("127.0.0.1", lookup)).rejects.toThrow();
    await expect(assertPublicHost("10.1.2.3", lookup)).rejects.toThrow();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects hostnames that resolve to private addresses (e.g. localhost)", async () => {
    const lookup = vi.fn(async () => [
      { address: "127.0.0.1", family: 4 },
      { address: "::1", family: 6 },
    ]);
    await expect(assertPublicHost("localhost", lookup)).rejects.toThrow();
  });

  it("rejects when any resolved address is private", async () => {
    const lookup = vi.fn(async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.0.9", family: 4 },
    ]);
    await expect(assertPublicHost("example.com", lookup)).rejects.toThrow();
  });

  it("accepts hosts that resolve to public addresses only", async () => {
    await expect(assertPublicHost("example.com", okLookup)).resolves.toBeUndefined();
  });
});

function feedResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, ...init });
}

describe("fetchFeed", () => {
  const XML = `<rss><channel><title>Ok Feed</title></channel></rss>`;

  it("fetches and parses a public feed", async () => {
    const fetchImpl = vi.fn(async () => feedResponse(XML));
    const feed = await fetchFeed("https://example.com/feed.xml", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      lookupFn: okLookup,
    });
    expect(feed.name).toBe("Ok Feed");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects non-http(s) URLs", async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchFeed("file:///etc/passwd", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookupFn: okLookup,
      }),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("follows redirects but re-validates the next host", async () => {
    const fetchImpl = vi.fn(async (_url: string) => {
      if (_url === "https://example.com/feed.xml") {
        return new Response(null, { status: 302, headers: { location: "http://10.0.0.5/x" } });
      }
      return feedResponse(XML);
    });
    await expect(
      fetchFeed("https://example.com/feed.xml", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookupFn: okLookup,
      }),
    ).rejects.toThrow();
  });

  it("follows safe redirects and parses the destination", async () => {
    const fetchImpl = vi.fn(async (_url: string) => {
      if (_url === "https://example.com/feed.xml") {
        return new Response(null, {
          status: 301,
          headers: { location: "https://feeds.example.com/rss" },
        });
      }
      expect(_url).toBe("https://feeds.example.com/rss");
      return feedResponse(XML);
    });
    const feed = await fetchFeed("https://example.com/feed.xml", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      lookupFn: okLookup,
    });
    expect(feed.name).toBe("Ok Feed");
  });

  it("rejects responses over the 5 MB content-length cap", async () => {
    const fetchImpl = vi.fn(async () =>
      feedResponse(XML, { headers: { "content-length": String(MAX_FEED_BYTES + 1) } }),
    );
    await expect(
      fetchFeed("https://example.com/feed.xml", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookupFn: okLookup,
      }),
    ).rejects.toThrow();
  });

  it("caps the body even without content-length", async () => {
    const big = "x".repeat(MAX_FEED_BYTES + 10);
    const fetchImpl = vi.fn(async () => feedResponse(`<rss><channel><title>${big}</title>`));
    await expect(
      fetchFeed("https://example.com/feed.xml", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookupFn: okLookup,
      }),
    ).rejects.toThrow();
  });

  it("rejects HTTP error statuses", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404 }));
    await expect(
      fetchFeed("https://example.com/feed.xml", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookupFn: okLookup,
      }),
    ).rejects.toThrow();
  });

  it("gives up after too many redirects", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(null, {
        status: 302,
        headers: { location: `https://example.com/hop-${fetchImpl.mock.calls.length}` },
      });
    });
    await expect(
      fetchFeed("https://example.com/feed.xml", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        lookupFn: okLookup,
      }),
    ).rejects.toThrow();
  });
});
