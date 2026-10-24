# Day 22 (build session 22) — 2026-10-26

**Build commit:** `a29aea0` · A1/A2 hardening pulled forward.

## What shipped
1. **Language guard** — the engine's splitter is Latin-script, so CJK/Cyrillic
   transcripts previously produced empty artifacts (a broken-looking page for
   international Show HN traffic). Now: `/api/generate-suite` returns
   `400 english_transcripts_only_for_now` when <60% of letters are Latin, and
   every tool page + the app show a friendly notice ("English transcripts
   only for now — language support is on the roadmap"). Accented Latin
   (café/naïve) passes correctly.
2. **`scripts/pull-metrics.mjs`** — launch-day tooling: streams `vercel logs`
   for N seconds, aggregates sk_usage/sk_event/sk_waitlist/sk_contact/
   sk_license counts, emits a METRICS.md-ready row. (Learned: `vercel logs`
   streams forever — the execFileSync version hung; rewritten with spawn +
   timeout kill.)
3. **Founding-member email draft** appended to `docs/launch-pack.md` (send to
   waitlist the moment LS is live).
4. **GitHub release v1.0.0** — https://github.com/gitAbid/episodekit/releases/tag/v1.0.0

## Verification (evidence)
- Mock tests: CJK → 400 with the exact code; emoji-with-English → 200;
  accented Latin → titles OK. `npm test` 62/62.
- Live: CJK → 400 `english_transcripts_only_for_now`; English → 200.
- pull-metrics smoke test runs (quiet window → honest zeros).
- GH release published (URL above).

## Not done / next (session 23 = A1, Mon Oct 27 09:00)
- A1 per ROADMAP: user unlocks (LS runbook, GLM/ASR keys) → verify checkout
  end-to-end with an LS test order; freeze risky changes.

## Blockers
Unchanged — the A1 user-side unlocks are the critical path for payments.
