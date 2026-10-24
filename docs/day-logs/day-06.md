# Day 6 — 2026-10-24

**Build commit:** (see follow-up docs commit) · pricing proof, waitlist, samples
context, directory kit.

## What shipped
1. **Waitlist capture** — `api/waitlist.js` (validate → dedupe → durable
   `sk_waitlist` log in Vercel function logs + warm-instance store with admin
   GET; same honest v0 pattern as track). Form embedded in the founding-members
   card on the landing page with success/error states.
2. **Real screenshots on the landing page** (captured from the live site via
   browser, 1280×800, committed to `site/img/`): app-result.png under "How it
   works" with a caption linking the sample suite; samples.png + pricing
   screenshot in a two-up "proof" grid under pricing. Images have alt text,
   lazy loading, and explicit dimensions (CLS-safe).
3. **Samples page context** — suiteToHtml now emits a highlight card explaining
   the page was generated end-to-end from the CC0 demo sermon with verbatim
   quotes + a "try it with your own sermon" CTA to the app. Sample regenerated.
4. **Directory submission kit** — `docs/directory-submissions.md`: master copy
   (name/one-liner/short/long descriptions, tags, pricing), per-directory
   submission URLs + notes (AlternativeTo, TAAFT, SaaSHub, Indie Hackers,
   Futurepedia, Uneed, DevHunt, BetaList), maker-disclosure blurb, status log.
   Submissions need user accounts — the kit makes each a 3-minute paste job.

## Verification (evidence)
- Waitlist handler mocks: valid 204, duplicate 200 `{already:true}`, invalid
  400, GET counters, DELETE 405; `node --check` pass. `npm test` 39/39
  (22 engine + 17 ASR).
- **Live**: landing 200 with screenshot embedded + waitlist form; live waitlist
  POST → 204 (accepted), invalid → 400; samples context block present;
  `/img/app-result.png` → 200.
- **Browser e2e (live)**: filled the waitlist form, clicked, got "You're on the
  list — we'll email you before public checkout opens."
- Caught + fixed during deploy: first `vercel --prod` ran from `site/img/`
  (stale shell cwd) producing a wrong-root deployment — redeployed from repo
  root and re-verified everything. (Lesson recorded: always deploy from repo
  root; the daily automation prompt already says work from repo root.)

## Not done / next (Day 7 start here)
- Roadmap Week-1 buffer/catch-up day: use it for the complaint-lexicon doc +
  first genuine community-value replies (no links unless directly helpful),
  plus any polish surfaced by the week's review → week-1-review.md.
- Directory submissions + GSC sitemap + custom domain: user-account actions
  (kit and instructions are ready).

## Blockers
None. Waitlist data is durable in Vercel function logs (export: dashboard →
Logs → filter `sk_waitlist`); KV-backed store when the account exists.
