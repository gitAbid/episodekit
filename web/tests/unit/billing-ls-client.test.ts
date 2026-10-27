import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { httpLsClient } from "@/lib/billing/ls";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("httpLsClient (single LS fetch boundary)", () => {
  it("creates a JSON:API checkout with store + variant relationships and custom data", async () => {
    process.env.LS_API_KEY = "sk_test";
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { attributes: { url: "https://ls.test/checkout/x" } } }), { status: 201 }),
    );
    const { url } = await httpLsClient.createCheckout({
      storeId: "1",
      variantId: "111",
      email: "maya@focus.fm",
      custom: { workspace_id: "ws-1" },
    });
    expect(url).toBe("https://ls.test/checkout/x");
    const [input, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(input).toBe("https://api.lemonsqueezy.com/v1/checkouts");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk_test");
    expect(headers["Content-Type"]).toBe("application/vnd.api+json");
    const body = JSON.parse(init.body as string) as {
      data: {
        type: string;
        attributes: { checkout_data: { email: string; custom: Record<string, string> } };
        relationships: Record<string, { data: { type: string; id: string } }>;
      };
    };
    expect(body.data.type).toBe("checkouts");
    expect(body.data.attributes.checkout_data.email).toBe("maya@focus.fm");
    expect(body.data.attributes.checkout_data.custom).toEqual({ workspace_id: "ws-1" });
    expect(body.data.relationships.store.data).toEqual({ type: "stores", id: "1" });
    expect(body.data.relationships.variant.data).toEqual({ type: "variants", id: "111" });
    delete process.env.LS_API_KEY;
  });

  it("cancels with DELETE /v1/subscriptions/:id and parses the cancelled state", async () => {
    process.env.LS_API_KEY = "sk_test";
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            attributes: {
              status: "cancelled",
              ends_at: "2026-11-30T00:00:00.000000Z",
              urls: { customer_portal: "https://ls.test/portal", update_payment_method: null },
            },
          },
        }),
        { status: 200 },
      ),
    );
    const result = await httpLsClient.cancelSubscription("sub_1");
    const [input, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(input).toBe("https://api.lemonsqueezy.com/v1/subscriptions/sub_1");
    expect(init.method).toBe("DELETE");
    expect(result.status).toBe("cancelled");
    expect(result.endsAt?.toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(result.customerPortalUrl).toBe("https://ls.test/portal");
    delete process.env.LS_API_KEY;
  });

  it("reads the signed customer-portal link for [Manage payment]", async () => {
    process.env.LS_API_KEY = "sk_test";
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { attributes: { status: "active", renews_at: "2026-11-27T00:00:00Z", urls: { customer_portal: "https://ls.test/portal" } } },
        }),
        { status: 200 },
      ),
    );
    const info = await httpLsClient.getSubscription("sub_1");
    expect(info.customerPortalUrl).toBe("https://ls.test/portal");
    expect(info.renewsAt?.toISOString()).toBe("2026-11-27T00:00:00.000Z");
    delete process.env.LS_API_KEY;
  });

  it("throws on non-2xx responses", async () => {
    process.env.LS_API_KEY = "sk_test";
    fetchMock.mockResolvedValue(new Response("nope", { status: 401 }));
    await expect(httpLsClient.cancelSubscription("sub_1")).rejects.toThrow("LS cancel failed: 401");
    delete process.env.LS_API_KEY;
  });
});
