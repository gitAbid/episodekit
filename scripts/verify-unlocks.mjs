#!/usr/bin/env node
// Unlock verifier — one command to verify the user-side unlocks end-to-end.
// Usage: node scripts/verify-unlocks.mjs
// 1. Reads /api/config. Reports payments/audio state.
// 2. If audio is enabled: synthesizes a voice sample (macOS `say` + ffmpeg),
//    uploads to /api/transcribe, and runs a full generation on the transcript.
// 3. If payments are enabled: reminds of the LS test-order flow (a purchase
//    can't be scripted) and checks recent webhook events via `vercel logs`.
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = "https://episodekit.vercel.app";
const cfg = await (await fetch(`${BASE}/api/config`)).json();
console.log(`payments: ${cfg.paymentsEnabled ? "ENABLED" : "disabled"} · audio: ${cfg.audioEnabled ? "ENABLED" : "disabled"}`);

if (cfg.audioEnabled) {
  const dir = mkdtempSync(join(tmpdir(), "ek-verify-"));
  const aiff = join(dir, "voice.aiff");
  const webm = join(dir, "voice.webm");
  execFileSync("say", ["-o", aiff, "Welcome back to the show. Today we are talking about deep work, and why focus is the most expensive resource in modern work. Nobody budgets attention like money, and that is the whole problem. Remember that a calendar block is a promise, while a to-do item is only a wish. One notification can tax the entire morning, because attention compounds like debt. So subtraction beats addition when choosing your tools."]);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", aiff, "-c:a", "libopus", "-b:a", "16k", webm]);
  const bytes = execFileSync("cat", [webm]);
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "audio/webm", "X-Filename": "voice.webm" },
    body: bytes,
  });
  if (!r.ok) {
    console.error(`transcribe FAILED: ${r.status}`, await r.text());
    process.exit(1);
  }
  const { transcript } = await r.json();
  console.log(`transcribe OK (${((Date.now() - t0) / 1000).toFixed(1)}s): "${transcript.slice(0, 80)}…"`);
  const gr = await fetch(`${BASE}/api/generate-suite`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "full", text: transcript }),
  });
  const g = await gr.json();
  if (!gr.ok || !g.suite) {
    console.error(`full suite FAILED: ${gr.status}`, JSON.stringify(g));
    process.exit(1);
  }
  console.log(`full suite from audio: engine=${g.suite.engine} · title="${g.suite.article.title}" · ${g.suite.discussion.qs.length} quote questions`);
  console.log("AUDIO PATH: ✅ verified end-to-end");
} else {
  console.log("audio path: still awaiting ASR_API_KEY (paste flow fully functional)");
}

if (cfg.paymentsEnabled) {
  console.log("payments: checkout links live. Complete the LS test order (runbook §7), then check for the sk_license event:");
  console.log("  node scripts/pull-metrics.mjs 20   # look for licenses>0");
} else {
  console.log("payments: still awaiting Lemon Squeezy env vars (docs/ls-activation-runbook.md)");
}
