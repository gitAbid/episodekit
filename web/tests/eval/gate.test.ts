import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { gatesPass, loadFixtures, runGate } from "../../evals/gate";

/**
 * WP-10 eval gate over all evals/transcripts fixtures. The deterministic
 * gates must pass regardless of AI keys (fallback packages are held to the
 * same quote/banned-word/schema rules). The LLM-judge gate is reported
 * BLOCKED without valid keys — never faked.
 */
describe("eval gate (8 transcripts)", () => {
  it("quote integrity 100% · banned words 0 · limits ≥98% · p90 ≤5min · cost ≤$0.50", { timeout: 300_000 }, async () => {
    const fixtures = loadFixtures(join(__dirname, "../../evals/transcripts"));
    expect(fixtures.length).toBeGreaterThanOrEqual(8);

    const summary = await runGate(fixtures);
    const verdict = gatesPass(summary);

    console.log(
      `eval gate: fixtures=${summary.fixtures} schema=${(summary.schemaCompliance * 100).toFixed(1)}% ` +
        `quotes=${(summary.quoteIntegrity * 100).toFixed(1)}% banned=${summary.bannedWordLeaks} ` +
        `p90=${Math.round(summary.p90DurationMs / 1000)}s maxCost=$${summary.maxCostPerEpisode.toFixed(3)} judge=${summary.judge.status}`,
    );

    expect(verdict.failures, verdict.failures.join("; ")).toEqual([]);
  });

  it("every quote-kind artifact carries at least one verbatim quote", { timeout: 300_000 }, async () => {
    const fixtures = loadFixtures(join(__dirname, "../../evals/transcripts"));
    const summary = await runGate(fixtures.slice(0, 2)); // spot-check two fixtures
    const quoteKinds = summary.episodes.filter((e) => ["quotes", "show_notes", "blog", "newsletter"].includes(e.kind));
    expect(quoteKinds.length).toBeGreaterThan(0);
    for (const e of quoteKinds) {
      expect(e.quoteIntegrity, `${e.fixture}/${e.kind}`).toBe(true);
    }
  });
});
