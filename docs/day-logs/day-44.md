# Day 43 addendum / Day 44 — 2026-10-27

**Build commit:** (see follow-up docs commit) · video + OG rebuilt in the flat design.

## What shipped
- **Demo video rebuilt** in the flat design: all 8 frames recaptured from the
  live app (post-redesign), title/end cards flattened to match (white bg,
  ink text, blue accent — glow rings removed from gen_cards.swift), same
  narration + Ken Burns + crossfade composition. 37.8s, 7.1MB; vertical
  9:16 cut rebuilt too.
- **OG image regenerated** with the flat branding (the generator was already
  updated in the user's redesign commit — just re-rendered).
- **README demo GIF regenerated** from the new video (3.3MB).

## Verification (evidence)
- 8 distinct frames; QC frame at t=17s shows the flat dark result page;
  ffprobe duration/size confirmed; vertical is 1080×1920.
- Live: demo.mp4 206 (range), og.png 200, landing embed present.
- GIF regenerated (3.3MB).

## Next
Launch-week calendar continues; the video/OG now match the design users will
see when they arrive.

## Blockers
User-side unlocks (docs/FOR-ABID.md) — in progress.
