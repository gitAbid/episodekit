# Day 33 (build session 33) — 2026-10-26

**Build commit:** `5770f68` · concurrency test caught a real bug.

## What shipped
**The pre-launch concurrency burst test caught a genuine bug that would have
broken real ASR users on launch day.**

1. **Bug**: `sentences()` required the next sentence to start with a capital
   letter — but ASR transcripts are frequently all-lowercase, collapsing a
   whole episode into one "sentence" → `not_enough_sentences` 400 → total
   failure for those users. Yesterday's sequential smoke passed only because
   it ran before the S27 guard deployed; today's 60-request burst surfaced it
   as 60/60 failures.
   **Fix**: split on sentence enders regardless of case; the 40-char minimum
   already filters abbreviation fragments. New permanent test:
   lowercase-transcript fixture.
2. **Second edge found by the new test**: with few sentences, equal-size
   segment chunking produced an empty final section. **Fix**: proportional
   slicing (every segment non-empty; counts verified for n=1…40).

## Verification (evidence)
- `npm test` **69/69** (32 engine + 17 ASR + 20 license).
- Live: the previously-failing body now returns titles.
- **Burst test after deploy: 60/60 OK, p50 0.46s, p90 1.89s, max 1.94s** —
  concurrency-ready for launch traffic.
- Unlock check: still disabled.

## Next
Sprint calendar: A2 Show HN Tue Oct 28.

## Blockers
User-side only (docs/FOR-ABID.md).
