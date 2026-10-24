# Day 17 (build session 17) — 2026-10-26

**Build commit:** `0b58b2c` · critical CTA bug fix.

## What shipped
**Found and fixed a real conversion-killing bug: every "email us" CTA on the
site was dead.** The landing footer, the app's upgrade button, and two error
messages pointed at `@episodekit.app` addresses — a domain we don't own, so
those emails bounced silently. Replaced with:
- `site/contact.html` — a simple working contact form, backed by
- `api/contact.js` — validation (email regex, 10+ char message, length caps)
  + durable `sk_contact` log entries (readable in Vercel logs — same honest
  v0 pattern as waitlist).
- All `mailto:` and stale-address strings removed (grep-verified: zero left).

Also checked: no `sk_*` events in live logs yet (expected — zero
distribution), CI green, 0 stars.

## Verification (evidence)
- Handler mocks: short message → 400, bad email → 400, valid → 204 with
  `sk_contact` log line, GET → 200.
- `npm test` 62/62; app inline JS syntax OK.
- Live: /contact 200; live POST → 204 (a real test message is in the logs).
- `grep -rcE "founders@|hello@" site/` → zero matches.

## Not done / next (session 18 start here)
- Maintenance/reactive mode stands. The remaining high-value moves are all
  user-side (see map red chips / runbook / launch pack).

## Blockers
Unchanged (LS account, GLM/ASR keys, PH/HN/GSC accounts).
