// Admin stats window helper + founding counter semantics (WP-08 entitlements).
import { describe, expect, it, vi } from "vitest";
import { EMPTY_STATS, statWindowCutoff } from "@/lib/admin/stats";
import { FOUNDING_TOTAL, foundingLeft } from "@/lib/billing/entitlements";
import { foundingRemainingForMarketing } from "@/lib/marketing/founding";
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

describe("founding counter (DB-derived, WP-08 entitlements)", () => {
  it("derives left from the workspace count and clamps at 0 and 100", () => {
    expect(foundingLeft(0)).toBe(FOUNDING_TOTAL);
    expect(foundingLeft(37)).toBe(63);
    expect(foundingLeft(FOUNDING_TOTAL)).toBe(0);
    expect(foundingLeft(FOUNDING_TOTAL + 20)).toBe(0);
  });

  it("marketing helper returns null when the DB is unavailable (no fake numbers)", async () => {
    // No DATABASE_URL in the test env → getDb() throws → null, never a number.
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect(await foundingRemainingForMarketing()).toBeNull();
    } finally {
      if (prev !== undefined) process.env.DATABASE_URL = prev;
    }
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
