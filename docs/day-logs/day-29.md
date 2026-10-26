# Day 29 (build session 29) — 2026-10-26

**Build commit:** `abecd7c` · webhook signature robustness.

## What shipped
**LS webhook signature verification hardened for activation day.** Vercel
hands JSON bodies to functions already parsed, so re-serializing may not
byte-match what Lemon Squeezy signed — a serialization quirk would 401 real
paying orders. Now: the signature is checked against the plausible
serializations (raw string if given, `JSON.stringify(body)`, and a recursive
sorted-key `stableStringify`), and any mismatch logs a
`sk_license/signature_mismatch` event with a payload preview (visible in
Vercel logs next morning) before 401-ing — checkout can't fail invisibly.
`stableStringify` exported for tests; new test proves the sorted-key fallback
accepts a legitimately-signed reordered payload (my first test draft signed a
partially-sorted variant and was correctly rejected — the guard works).

## Verification (evidence)
- `npm test` **67/67** (30 engine + 17 ASR + 20 license incl. the new
  sorted-key case). Deployed.
- Unlock check at session start: still disabled.

## Next
Sprint calendar: A2 Show HN Tue Oct 28.

## Blockers
User-side only (docs/FOR-ABID.md).
