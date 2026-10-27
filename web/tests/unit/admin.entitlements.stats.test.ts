// Admin stats window helper + entitlements stub (WP-08 seam).
import { describe, expect, it, vi } from "vitest";
import { EMPTY_STATS, statWindowCutoff } from "@/lib/admin/stats";
import { FOUNDING_TOTAL, configEntitlements, foundingRemaining } from "@/lib/billing/entitlements";
import { captureServerEvent, posthogConfigured } from "@/lib/analytics/posthog";

describe("stat window", () => {
  it("cutoff is 7 days back and empty stats never fake numbers", () => {
    const now = new Date("2026-10-27T12:00:00Z");
    expect(statWindowCutoff(now).toISOString()).toBe("2026-10-20T12:00:00.000Z");
    expect(EMPTY_STATS).toEqual({
      signups7d: null,
      episodes7d: null,
      exports7d: null,
      paying: null,
      aiCost7dUsd: null,
      dbAvailable: false,
    });
  });
});

describe("founding counter (entitlements stub seam)", () => {
  it("defaults to the full 100 remaining (true today: none sold)", async () => {
    expect(await foundingRemaining({} as unknown as NodeJS.ProcessEnv)).toBe(FOUNDING_TOTAL);
  });

  it("derives from FOUNDING_SOLD and clamps", async () => {
    expect(await configEntitlements({ FOUNDING_SOLD: "37" } as unknown as NodeJS.ProcessEnv).foundingRemaining()).toBe(63);
    expect(await configEntitlements({ FOUNDING_SOLD: "120" } as unknown as NodeJS.ProcessEnv).foundingRemaining()).toBe(0);
    expect(await configEntitlements({ FOUNDING_SOLD: "nonsense" } as unknown as NodeJS.ProcessEnv).foundingRemaining()).toBe(100);
  });
});

describe("posthog server capture", () => {
  it("is a silent no-op without the key", async () => {
    expect(posthogConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(await captureServerEvent("u1", "feedback_submitted", {}, { env: {} as unknown as NodeJS.ProcessEnv })).toBe(false);
  });

  it("posts to the capture API when configured", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const ok = await captureServerEvent("u1", "feedback_submitted", { rating: 1 }, {
      env: { NEXT_PUBLIC_POSTHOG_KEY: "phc_x" } as unknown as NodeJS.ProcessEnv,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://us.i.posthog.com/capture/");
    const body = JSON.parse(String(init.body)) as { api_key: string; event: string; distinct_id: string };
    expect(body).toMatchObject({ api_key: "phc_x", event: "feedback_submitted", distinct_id: "u1" });
  });
});
