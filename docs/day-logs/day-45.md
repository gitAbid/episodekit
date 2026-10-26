# Day 45 (build session 45) — 2026-10-27

**Build commit:** (see follow-up docs commit) · **AUDIO PATH IS LIVE.**

## The unlock
User added ASR + GLM keys to Vercel. Executed the A1 unlock verification:
1. Redeploy (env vars need a fresh deploy) → `/api/config`: **audioEnabled: true**.
2. `node scripts/verify-unlocks.mjs` → transcribe OK in 1.3s with correct
   punctuation, full package generated from the audio transcript
   ("Attention — Focus", 5 quote questions). **AUDIO PATH: ✅ end-to-end.**
   (First run crashed on my verifier's own too-short sample — fixed the
   sample to a 6-sentence passage + graceful 400 handling.)
3. GLM path: probed → found `upstream_400` (old inline fetch), refactored
   discussion-guide mode onto the engine's dual-endpoint `chat()`, added
   upstream detail to the 502. Diagnostics then showed the real chain:
   coding-plan endpoint + key **authenticate**; models glm-4.6/4.5-air/4.5
   are recognized; final error = **1113 "Insufficient balance or no resource
   package"** → the key's Z.ai account needs an active coding plan/resource
   package. Integration is now correct and cached (working endpoint tried
   first); lights up with zero further changes once the account has balance.

## Verification (evidence)
- Live: audioEnabled true; transcribe 1.3s with verbatim transcript; full
  suite 200 from audio; discussion-guide detail exposed endpoint-by-endpoint
  errors (api.z.ai 429/1113, bigmodel 1211).
- `npm test` 69/69 suite runs green across the refactor (chat is not
  unit-mocked; validator tests unaffected).

## State
✅ ASR live · ⚠️ GLM (integration correct; needs resource package/balance on
the Z.ai account) · ⏳ Lemon Squeezy store (payments). Deterministic engine
covers all of it meanwhile.

## Next
A2 Show HN Oct 28. GLM resumes the moment the resource package is active.
