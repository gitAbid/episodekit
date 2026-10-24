# Day 5 — 2026-10-24

**Build commit:** (see follow-up docs commit) · **SermonKit is LIVE:
<https://sermonkit.vercel.app>**

## What shipped
1. **Production deploy on Vercel.** Vercel CLI was already authenticated
   (account `perabyteai-6559`, team pera-byte). Deployed from repo root
   (static `site/` + `api/` functions), then:
   - Disabled Deployment Protection (`ssoProtection: null` via PATCH
     /v9/projects — public access verified with unauthenticated curl).
   - Renamed project `project-okra` → **`sermonkit`**; detached the stale
     `project-okra.vercel.app` domain; added `sermonkit.vercel.app` as the
     project domain so it **auto-attaches on every deploy** (learned the hard
     way: a manual `vercel alias set` pins one deployment and goes stale —
     do not use for the prod domain).
2. **Engine polish**: light-verb stopwords ("comes/wants/means/takes/…") — live
   themes went from `patience, comes, trust` to `patience, virtue, praise,
   practice, farmer`. 22/22 + 17/17 tests green; sample suite regenerated.
3. **Accessibility fixes** from the first Lighthouse run: `<main>` landmark on
   the landing page; founding-member link given accent color + underline
   (link-in-text-block contrast).
4. README + memory updated with the live URL and deploy procedure.

## Verification (evidence)
- All live URLs unauthenticated 200 (landing, samples, app, tools ×3 + hub,
  robots, sitemap, og.png, js); `.html` URLs 308-redirect to clean URLs → 200.
- Live API: `generate-suite` (titles mode) returned real engine output;
  `transcribe` → 503 `not_configured` (correct, no key); `track` POST 204 and
  GET returning counters (first pageviews recorded: 3).
- **Live browser e2e** on https://sermonkit.vercel.app/app: paste flow →
  result rendered (6 cards, title "Patience — Comes" pre-fix), quota 3→2.
- **Lighthouse (mobile emulation, CLI + local Chrome): Performance 100,
  Accessibility 100, Best Practices 96, SEO 100** — was a11y 89 before fixes.
- PSI API unavailable (anonymous quota 429) — used Lighthouse CLI instead.

## Not done / next (Day 6 start here)
- Pricing/waitlist page polish + docs/samples page using the real suite.
- Directory submissions prep (needs stable live URL — now available).
- GSC sitemap submission is a **user action** (needs their Google account):
  search.google.com/search-console → add property sermonkit.vercel.app →
  Sitemaps → submit /sitemap.xml. Documented here and in the day summary.
- ASR/GLM keys still unset → audio path + AI enhancement activate when added
  (Vercel dashboard → sermonkit → Settings → Environment Variables).

## Blockers
None for the product. GSC + custom domain + Lemon Squeezy account are
user-side items on the roadmap's "Needs from user" list.
