import { describe, expect, it } from "vitest";
import { capStatus, dailyCapUsd, memorySpendStore, utcDay } from "@/lib/tools/cost-cap";

describe("free tool daily cost cap", () => {
  it("defaults to $3 and parses FREE_TOOL_DAILY_USD", () => {
    expect(dailyCapUsd({} as unknown as NodeJS.ProcessEnv)).toBe(3);
    expect(dailyCapUsd({ FREE_TOOL_DAILY_USD: "1.5" } as unknown as NodeJS.ProcessEnv)).toBe(1.5);
    expect(dailyCapUsd({ FREE_TOOL_DAILY_USD: "nonsense" } as unknown as NodeJS.ProcessEnv)).toBe(3);
    expect(dailyCapUsd({ FREE_TOOL_DAILY_USD: "-2" } as unknown as NodeJS.ProcessEnv)).toBe(3);
  });

  it("reports not-exceeded with no store (cap unenforced, documented)", async () => {
    const status = await capStatus(null, { env: {} as unknown as NodeJS.ProcessEnv });
    expect(status).toEqual({ exceeded: false, spent: null, cap: 3 });
  });

  it("exceeds once spend reaches the cap", async () => {
    const store = memorySpendStore();
    await store.addCost(1.5);
    let status = await capStatus(store, { env: { FREE_TOOL_DAILY_USD: "3" } as unknown as NodeJS.ProcessEnv });
    expect(status.exceeded).toBe(false);
    await store.addCost(1.5);
    status = await capStatus(store, { env: { FREE_TOOL_DAILY_USD: "3" } as unknown as NodeJS.ProcessEnv });
    expect(status.exceeded).toBe(true);
    expect(status.spent).toBe(3);
  });

  it("spend is per UTC day", async () => {
    let now = new Date("2026-10-27T10:00:00Z");
    const store = memorySpendStore({ now: () => now });
    await store.addCost(5);
    expect(await store.spentToday()).toBe(5);
    now = new Date("2026-10-28T10:00:00Z");
    expect(await store.spentToday()).toBe(0);
    expect(utcDay(now)).toBe("2026-10-28");
  });
});
