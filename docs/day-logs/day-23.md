# Day 23 (build session 23) — 2026-10-25

**Build commit:** (see follow-up docs commit) · pre-A1 launch prep.

## What shipped
1. **Referrer tracking verified for A2**: beacon with an HN-style referrer →
   `byRef: {news.ycombinator.com: 1}` — Show HN traffic will be attributable
   (path + referrer host) on launch day.
2. **`docs/build-story.md`** — the launch-week narrative ("EpisodeKit in 3
   days, by an agent"): receipts table mapping every claim to evidence, the
   honest parts (deterministic-first engine, the day-7 pivot kept in history,
   the unimpressive-but-logged numbers, what the agent can't do), and the
   verbatim-quote rationale. Linked from the README (first thing GitHub
   visitors see after the demo GIF).
3. **Release assets** — demo.mp4, demo-vertical.mp4, og.png attached to the
   v1.0.0 GitHub release.

## Verification (evidence)
- Live track test above; release assets listed via `gh release view`.
- No product code changed — tests untouched (62/62 from last run), no deploy
  needed beyond the status.json map update.

## Not done / next (session 24 = A1, Mon Oct 27 09:00)
- A1: user unlocks (LS runbook + GLM/ASR keys) → LS test order end-to-end,
  AI/audio path verification, freeze.

## Blockers
Unchanged — user-side unlocks remain the critical path.
