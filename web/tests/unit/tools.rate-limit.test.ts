import { describe, expect, it } from "vitest";
import { consumeDaily, resetRateLimits } from "@/lib/tools/rate-limit";

describe("free tool rate limiter (5/day/IP)", () => {
  it("allows the first five requests and blocks the sixth", () => {
    resetRateLimits();
    const results = Array.from({ length: 6 }, () => consumeDaily("1.2.3.4", 5));
    expect(results.slice(0, 5).map((r) => r.allowed)).toEqual([true, true, true, true, true]);
    expect(results[5]).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("tracks IPs independently", () => {
    resetRateLimits();
    for (let i = 0; i < 5; i++) consumeDaily("9.9.9.9", 5);
    expect(consumeDaily("9.9.9.9", 5).allowed).toBe(false);
    expect(consumeDaily("8.8.8.8", 5).allowed).toBe(true);
  });

  it("resets the window at the next UTC midnight", () => {
    resetRateLimits();
    const now = new Date("2026-10-27T23:59:59Z");
    for (let i = 0; i < 5; i++) consumeDaily("1.1.1.1", 5, { now });
    const blocked = consumeDaily("1.1.1.1", 5, { now });
    expect(blocked.allowed).toBe(false);
    const nextDay = new Date("2026-10-28T00:00:01Z");
    const reset = consumeDaily("1.1.1.1", 5, { now: nextDay });
    expect(reset.allowed).toBe(true);
    expect(reset.resetAt).toBe(Date.UTC(2026, 9, 29));
  });
});
