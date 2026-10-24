# Day 14 (build session 14) — 2026-10-26

**Build commit:** (see follow-up docs commit) · launch-day de-risking.

## What shipped
1. **Quote-validator hardening** (`engine/glm.js`): real LLMs return
   typographic variants (curly quotes, em-dashes, ellipsis-marked
   truncations). Previously those failed the verbatim check → whole artifacts
   silently fell back to deterministic, quietly gutting the "AI-enhanced"
   promise on launch day. Now: punctuation-style normalization + edge-ellipsis
   stripping → verbatim fragments accepted; paraphrases still rejected.
   Bug found by the new tests themselves (ellipsis regex required a space
   before "…"): fixed, **62/62 tests**.
2. **`docs/ls-activation-runbook.md`** — exact 15-minute click-path: store
   setup, 3 products/variants with prices (incl. quantity-capped Founder 50),
   buy links, webhook (URL + signing secret + send-test), the six env vars
   with a concrete `LS_VARIANTS` JSON example, buyer-key delivery options,
   end-to-end verification steps, and pitfalls. This turns the user-side
   revenue unlock from "figure it out" into "follow the checklist".

## Verification (evidence)
- New tests: curly-quoted/ellipsized verbatim quotes accepted (no silent
  fallback); punctuation-normalized paraphrase still rejected. `npm test`
  62/62 (26 engine + 17 ASR + 19 license).
- CI green on the push; deployed; site 200.

## Not done / next (session 15 start here)
- Thin queue by design: maintain polish, watch for first real usage signals
  (sk_usage in logs), execute any user-unlocked activation (LS/keys) the day
  they land, using the runbook.

## Blockers
Unchanged: revenue gating is user-side (LS account, GLM/ASR keys, launch
accounts) — runbook now makes the LS part friction-free.
