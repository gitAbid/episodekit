# Day 7 (build session 7) — 2026-10-25

**Build commit:** `8333ab0` · pivot + payment rail + live map.

## What shipped
1. **Positioning pivot: SermonKit → EpisodeKit.** User set a hard constraint:
   no religious-domain products. Full rebrand of every user-facing surface and
   the engine itself: artifacts are now article (show notes), discussion kit,
   5-day email series, social pack, summary, titles. New original CC0 demo
   (`docs/samples/demo-episode.txt`, 575 words); old demo deleted. Vercel
   project renamed → **https://episodekit.vercel.app**; `sermonkit.vercel.app`
   domain deleted (404). OG image regenerated; sitemap/robots updated; tools
   renamed (`episode-titles`, `email-series`) + hub/discussion-kit rewritten.
   **Permanent test gate added: output must be religion-free** (regex on suite
   JSON + rendered markdown/html).
2. **Payment rail (pulled forward from Day 8).** `api/license-keys.js`
   (stateless HMAC keys, SK1/SK4/SKF plans), `api/ls-webhook.js`
   (signature-verified Lemon Squeezy webhook → issues license), `api/license.js`
   + `api/config.js` (validation + checkout config), in-app license activation
   + checkout buttons (inert until LS env set). Bug caught by tests: key
   validation uppercased the base36 stamp → HMAC mismatch; fixed with
   case-insensitive normalization.
3. **Live sprint mind map** (user request): `site/map.html` +
   `site/status.json`. Branch/leaf tree with status chips (done/in-progress/
   next/needs-user), decision-log timeline, next-up pills, six metric cards
   with **live polling** (pageviews/visitors from `/api/track`, waitlist count
   from `/api/waitlist` — GET changed to counts-only, no emails exposed).
   Daily cadence now requires updating status.json (ROADMAP).
4. Week-1 review (`docs/day-logs/week-1-review.md`, honest: 3 pageviews / 2
   test waitlist entries / $0 — distribution hasn't fired yet) + podcast-space
   complaint lexicon + EpisodeKit directory kit.

## Verification (evidence)
- `npm test`: **60/60** (24 engine incl. religion-free gates + honesty, 17
  ASR, 19 license/webhook incl. forgery + signature rejection).
- API contracts mocked post-pivot: titles/series/full → 200 (series anchors
  verbatim), old `devotionals` mode → 400, waitlist GET exposes no emails.
- **Live**: episodekit.vercel.app all pages 200 (landing/map/samples/app/tools/
  og/status.json), generate-suite returns real engine output, old sermonkit
  domain 404.
- **Live browser e2e**: app paste flow on the new domain → full package
  rendered ("Attention — Version", 6 cards); map page DOM verified (5 branches,
  29 leaves, 6 metrics populated live: 28/24/60/2/2/0, 6 timeline items, 6
  pills; day counter live-computed "day 2 of 30").
- **Visual QA on the map**: two viewport captures → **SHIP/SHIP** (earlier
  "triple duplication" was conclusively the fullPage screenshot stitching
  method, not the page — DOM counts proved single-copy; sticky header removed
  anyway). Fresh live screenshots captured for the landing page (hero, pricing,
  samples, app result).
- Engine polish: rhetorical-marker stopwords restored ("because/therefore/…")
  after themes check caught "because" leaking.

## Not done / next (Day 8 / session 8 start here)
- Submit directories + GSC (user accounts) — kit ready.
- Lemon Squeezy activation when credentials arrive (rail is built + tested).
- Demo video #1 + comparison pages (vs Podsqueeze / Castmagic).

## Blockers
None. User-side items unchanged: LS account, ASR/GLM keys, directory + GSC
accounts, optional domain (episodekit.app).
