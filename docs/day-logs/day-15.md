# Day 15 (build session 15) — 2026-10-26

**Build commit:** (see follow-up docs commit) · first-run honesty + Shorts asset.

## What shipped
1. **Config-driven first-run UX** — `/api/config` now reports `audioEnabled`
   (derived from ASR env). Until an ASR key exists, the app **defaults to the
   paste tab** and shows an honest note on the audio pane ("activates at
   public launch — paste works today"). Before: a first-time visitor landing
   on the audio tab hit a dead end. The day keys land, the app flips itself
   back to audio-first with zero code changes.
2. **Vertical 9:16 demo cut** — `site/demo-vertical.mp4` (1080×1920, blurred
   side-pad, same narration, 37.8s, 6.8MB): the Shorts/TikTok asset for launch
   week. Streams with range support.

## Verification (evidence)
- Config handler mock: no keys → `audioEnabled:false` (and paymentsEnabled
  false) — matches live: production `/api/config` returns the same.
- `npm test` 62/62; deployed; vertical demo 206 on range request.

## Not done / next (session 16 start here)
- Maintenance mode: watch `sk_usage` for first real usage; execute
  runbook/launch steps the moment user-side unlocks land.

## Blockers
Unchanged (LS account, GLM/ASR keys, PH/HN/GSC accounts).
