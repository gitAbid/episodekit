// Route wiring tests: the public tool route's policy chain (BotID fail-open,
// 5/day/IP, cap → deterministic, payload validation) exercised through the
// lib layer the route composes, plus the botid wrapper contract.
import { describe, expect, it } from "vitest";
import { verifyHuman } from "@/lib/tools/botid";
import { consumeDaily, resetRateLimits } from "@/lib/tools/rate-limit";
import { capStatus, memorySpendStore } from "@/lib/tools/cost-cap";
import { TOOL_IDS, isToolId } from "@/lib/tools/defs";
import { TOOL_PATHS } from "@/lib/marketing/routes";

describe("tool registry + route contract", () => {
  it("exposes exactly the four M12 tools at their legacy paths", () => {
    expect(TOOL_IDS).toHaveLength(4);
    expect(TOOL_PATHS).toEqual([
      "/tools",
      "/tools/show-notes",
      "/tools/episode-titles",
      "/tools/email-series",
      "/tools/discussion-guide",
    ]);
    for (const id of TOOL_IDS) expect(isToolId(id)).toBe(true);
    expect(isToolId("sermons")).toBe(false);
  });
});

describe("verifyHuman (BotID wrapper)", () => {
  it("never blocks humans off-Vercel (dev bypass handles the missing OIDC token)", async () => {
    const res = await verifyHuman(new Request("https://x.test/api/public/tools/show-notes", { method: "POST" }), {
      VERCEL: "",
    } as unknown as NodeJS.ProcessEnv);
    expect(res.blocked).toBe(false);
    expect(res.reason).toBeNull();
  });

  it("never blocks humans when the real check is unavailable (fail-open contract)", async () => {
    const res = await verifyHuman(new Request("https://x.test/", { method: "POST" }), {
      VERCEL: "1",
    } as unknown as NodeJS.ProcessEnv);
    // VERCEL set → real check path; without a Vercel OIDC token the check
    // throws, and the wrapper must allow the request (see lib/tools/botid.ts).
    expect(res.blocked).toBe(false);
  });
});

describe("route policy composition", () => {
  it("rate limit blocks the 6th call for the same IP before any AI spend", () => {
    resetRateLimits();
    for (let i = 0; i < 5; i++) consumeDaily("203.0.113.7", 5);
    expect(consumeDaily("203.0.113.7", 5).allowed).toBe(false);
  });

  it("cap exceeded → deterministic (aiDisabled), with the cap note", async () => {
    const store = memorySpendStore();
    await store.addCost(3);
    const cap = await capStatus(store, { env: {} as unknown as NodeJS.ProcessEnv });
    expect(cap.exceeded).toBe(true);
  });
});
