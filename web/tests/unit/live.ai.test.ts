// LIVE provider smoke test — NOT run in CI (skips without GLM_API_KEY; also
// skips when CI=true even if a key leaks into the environment).
//
// Run locally with real keys:
//   set -a; source /path/to/.env.relaunch; set +a
//   cd web && GLM_API_KEY=$GLM_API_KEY pnpm vitest run tests/unit/live.ai.test.ts
import { describe, expect, it } from "vitest";
import { DEFAULT_AI_SELECTION } from "@/lib/ai/settings";
import { buildProvider } from "@/lib/ai/registry";
import { generateArtifact } from "@/lib/ai/generate";
import { DEFAULT_VOICE_PROFILE } from "@/lib/ai/voice";

const live = Boolean(process.env.GLM_API_KEY) && process.env.CI !== "true";
const t0 = () => Date.now();

describe.skipIf(!live)("live: GLM coding endpoint through the registry", () => {
  it("answers a tiny JSON prompt", async () => {
    const p = buildProvider(DEFAULT_AI_SELECTION, {
      tier: "fast",
      env: process.env as NodeJS.ProcessEnv,
    });
    const start = t0();
    const res = await p.complete({
      system: 'You are a health check. Return only JSON.',
      user: 'Return the JSON object {"ok":true}.',
      model: DEFAULT_AI_SELECTION.fastModel,
      json: true,
      temperature: 0.2,
    });
    const latencyMs = t0() - start;
    const parsed = JSON.parse(res.text);
    expect(parsed.ok).toBe(true);
    console.log(
      `[live] provider=glm-coding model=${DEFAULT_AI_SELECTION.fastModel} latencyMs=${latencyMs} usage=${JSON.stringify(res.usage ?? null)}`,
    );
  }, 90_000);

  it("generates a real artifact via generateArtifact (fallback-labelled on provider outage)", async () => {
    const text = `Host: Welcome back to the show. Today we talk about attention in ordinary weeks.
Guest: Thanks for having me. The biggest thing I learned is that focus is a trained skill, not a gift.
Host: Tell us about the two-minute reset you teach.
Guest: The idea is simple. You stop, breathe for two minutes, and write the one next action on paper.
Host: People love that. It works because it removes the decision, not the effort.`;
    const { makeSegments } = await import("./helpers/ai");
    const segments = makeSegments(text, 1);
    const start = t0();
    const res = await generateArtifact({
      kind: "summary",
      segments,
      show: { name: "Live Test Show", defaultCta: "Follow.", allowedUrls: [] },
      voice: DEFAULT_VOICE_PROFILE,
      deps: { env: process.env as NodeJS.ProcessEnv, workspaceId: null, episodeId: null },
    });
    console.log(
      `[live] generateArtifact status=${res.status} provider=${res.provider} model=${res.model} ` +
        `errorCode=${res.errorCode} latencyMs=${t0() - start} costUsd=${res.costUsd} usage=${JSON.stringify(res.usage)}`,
    );
    expect(["ai", "fallback"]).toContain(res.status);
    expect(res.content).toBeTruthy();
  }, 120_000);
});
