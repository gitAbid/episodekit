# Cutover checklist (WP-10)

Run when the owner has completed the key unlocks in `docs/FOR-ABID.md`
(§2 AI keys, §6 Clerk + Neon, Blob token) and the eval gate has passed with
live AI (`pnpm --dir web eval` — judge must not be BLOCKED).

## Preconditions
- [ ] `node web/scripts/verify-env.mjs production episodekit-web` — all required present
- [ ] `pnpm --dir web eval` — judge = ok, faithfulness ≥4.3, usefulness ≥4.0
- [ ] Owner reviewed ≥4 of 5 packages: "would publish with light edits"
- [ ] `pnpm --dir web lint && pnpm --dir web typecheck && pnpm --dir web test` green on main
- [ ] URL parity: legacy `site/sitemap.xml` paths all 200 on the new app (U17 test)

## Execute
- [ ] `./scripts/cutover.sh` (moves site/ api/ engine/ → legacy/, drops legacy vercel.json)
- [ ] Vercel project `episodekit` (old live site): disconnect from repo or retarget `legacy/`
- [ ] Vercel project `episodekit-web`: Root Directory = `web/`, Production branch = `main`, deploy
- [ ] `pnpm --dir web exec drizzle-kit migrate` against production `DATABASE_URL`
- [ ] Clerk webhook endpoint → `https://<prod-domain>/api/webhooks/clerk`
- [ ] Lemon Squeezy webhook → `/api/webhooks/lemonsqueezy` (when LS keys land)

## Post-cutover verification
- [ ] `/`, `/tools/show-notes`, `/pricing`, `/privacy`, `/terms` → 200
- [ ] Sign-up (email link + Google) → onboarding step 1 → workspace(plan=free)
- [ ] Sample episode → full 7-artifact package in ≤5 min, quotes verified
- [ ] Free-tool rate limit + cost cap live; `/admin` owner-only
- [ ] Legacy URLs redirect or 200 (U17 parity)
- [ ] `docs/FOR-ABID.md` updated: remaining owner actions checked off
