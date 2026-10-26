# Day 28 (build session 28) — 2026-10-26

**Build commit:** `639372e` · pre-activation crash fix.

## What shipped
**Found by tracing the GLM-activation path**: when a key lands, the discussion
tool's AI response would have **crashed the page** — the renderer indexes
`g.apply[0]` but the AI prompt never asked for `apply`. Fixed both ends:
- API prompt now requests `apply` (2 action prompts) for discussion-guide mode.
- The page always computes the heuristic shape first and overlays AI fields on
  top, with per-field guards (apply/open/qs) — a missing or short AI array can
  never crash the renderer; it falls back per-field. Verified by simulating the
  old crash shape (AI missing `apply`, 2-item `open`, 1-item `qs`) through the
  new merge — renders cleanly with heuristic backfill.

## Verification (evidence)
- Merge-guard simulation: apply[0] backfilled, open→2 (base), qs→5 (base),
  kind:"ai", no crash. `npm test` 66/66.
- Live: guide mode still 503s correctly (no key), page renders offline path.
- Unlock check: still disabled.

## Next
Sprint calendar (A2 Tue Oct 28).

## Blockers
User-side only (docs/FOR-ABID.md).
