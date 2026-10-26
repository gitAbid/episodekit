# Day 27 (build session 27) — 2026-10-26

**Build commit:** `61e1ecb` · degenerate-input guards.

## What shipped
Two more real-world input edges found by adversarial testing, closed:
1. **No-punctuation / all-short-sentence / pure-repetition inputs** previously
   produced **completely empty artifacts** (0 sections, 0 quotes — a
   broken-looking page) while passing the word-count gate. Now the API fails
   honestly: `400 not_enough_sentences` (<4 distinct full sentences), with
   friendly alerts on every tool page and the app.
2. **Duplicate sentences deduped** in `analyzeTranscript` (order-preserving) —
   repetition inputs can no longer fill a discussion kit with 6 identical
   quotes. Permanent engine test added.
Verified live: the no-punctuation probe → `not_enough_sentences`; healthy
speaker-labeled input → "Attention and Focus" (S26 fix intact).

Also: unlock check (still disabled); repo inbox empty (0 issues/stars/forks).

## Verification (evidence)
- API probes: spam → 400 not_enough_sentences; short-sents → 400;
  repeat-with-periods → caught by existing length gate; healthy → 200.
- `npm test` 66/66 (30 engine + 17 ASR + 19 license), 3 suites green.
- Deployed + live-verified.

## Next
Sprint calendar (A2 Tue Oct 28). Machine on 9am/9pm with unlock detection.

## Blockers
User-side only (docs/FOR-ABID.md) — unchanged.
