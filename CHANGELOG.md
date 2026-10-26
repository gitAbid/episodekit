# Changelog

All entries map to a commit. Newest first.

## Unreleased — 2026-10-26
- **Visual redesign: flat design system.** Replaced the gold "midnight
  editorial" theme with a flat, light-first system (automatic dark mode, Inter
  only, one solid blue accent, 1px borders, no gradients/glows/shadows).
  Landing rebuilt with plain product copy, an HTML product preview using real
  sample output, a quote-check example, pricing and FAQ; app gets underline tabs,
  an accessible dropzone and a sticky results toolbar; every inner page, the
  sprint map and the generated samples template use the shared system; OG image
  regenerated to match. Fixed an empty result card showing on tool pages before
  generation and table overflow on mobile.

## Day 43 (build session 43) — 2026-10-26
- Redesign carried through inner pages; fixed broken theme import (over-broad
  regex) — computed-style sweep verifies 7/7 page classes on the new design

## Day 42 (build session 42) — 2026-10-26
- **Visual redesign "midnight editorial"**: Fraunces+Inter design system,
  landing + tools + app re-skinned, responsive/native across form factors;
  Lighthouse P94/A100/BP96/SEO100 after font/contrast fixes; proof images
  recaptured

## Day 41 (build session 41) — 2026-10-26
- Mobile nav polish (390px audit) + one-click demo-transcript loader in the
  paste flow; textarea opens at top

## Day 40 (build session 40) — 2026-10-26
- Maintenance: sweep green, unlocks pending

## Day 39 (build session 39) — 2026-10-26
- Maintenance: sweep green, unlocks pending

## Day 38 (build session 38, scheduled 21:00) — 2026-10-26
- Scheduled-session procedure run: uptime 4/4 + canonical probe 200; unlock
  check still disabled (A1 user-side window open); no incidents

## Day 37 (build session 37) — 2026-10-26
- Maintenance: canonical-probe sweep green (unlocks still disabled, 69/69)

## Day 36 (build session 36) — 2026-10-26
- Ops: canonical uptime-probe body pinned in ROADMAP (prevents false incident
  flags from short probes tripping the input guards); automation alive

## Day 35 (build session 35) — 2026-10-26
- Post-fix verification: lowercase full-suite live-verified; 5/5 uptime;
  regenerated sample confirmed deployed; no issues

## Day 34 (build session 34) — 2026-10-26
- Sample suite regenerated with the current engine (post-splitter changes);
  truth-in-advertising on the samples page preserved

## Day 33 (build session 33) — 2026-10-26
- Case-insensitive sentence splitting (all-lowercase ASR transcripts fixed —
  caught by the 60-request burst test) + proportional segments; 69/69;
  burst re-run 60/60 OK

## Day 32 (build session 32) — 2026-10-26
- HN/Reddit mention scan (zero — field clear for A2); A7 transparency post
  pre-drafted (docs/sprint-report-draft.md)

## Day 31 (build session 31) — 2026-10-26
- Maintenance session: full health sweep green (5/5 uptime, 67/67 tests, CI
  success, live generation verified); no invented work — frozen for A2

## Day 30 (build session 30) — 2026-10-26
- scripts/verify-unlocks.mjs: one-command unlock verification (voice-sample
  audio e2e + LS test-order guide)

## Day 29 (build session 29) — 2026-10-26
- LS webhook: multi-variant signature verification + mismatch logging (67/67
  tests incl. sorted-key serialization case)

## Day 28 (build session 28) — 2026-10-26
- Fixed latent GLM-activation crash in the discussion tool (AI shape merged
  over heuristic baseline with per-field guards)

## Day 27 (build session 27) — 2026-10-26
- Degenerate-input guards: honest 400s for no-punctuation / all-short /
  repetition inputs; sentence dedup; friendly client alerts (66/66 tests)

## Day 26 (build session 26) — 2026-10-26
- Speaker-label stripping for real-ASR transcripts (themes/titles clean);
  flaky license test fixed (65/65 × 3 runs); tool-page bank synced

## Day 25 (build session 25) — 2026-10-26
- Production latency smoke (p50 0.38s / p90 0.59s / 0 fails); unlock-detection
  automation now 9am+9pm for launch week

## Day 24 (build session 24) — 2026-10-25
- A1 checklist executed early (all green) — feature freeze for launch
- docs/FOR-ABID.md (useru2019s 5 actions, one page); A7 report template

## Day 23 (build session 23) — 2026-10-25
- Build-story doc (launch narrative, receipts) linked from README; demo assets
  attached to GH v1.0.0; HN-referrer tracking verified live

## Day 22 (build session 22) — 2026-10-26
- Language guard: non-Latin transcripts → honest 400 + friendly notices (was empty artifacts)
- scripts/pull-metrics.mjs (launch-day sk_* aggregation from Vercel logs)
- Founding-member email draft in launch pack; GitHub release v1.0.0

## Day 21 (build session 21) — 2026-10-26
- Site-wide QA sweep: 15-page link crawl + 14 live routes — zero broken links
- Lighthouse re-run caught an a11y regression (color-only links from newer
  content) — fixed; landing back to 100/100/100

## Days 11–20 (sessions 11–20) — 2026-10-25/26 (catch-up summary)
- D11: show-notes template page + landing FAQ + SoftwareApplication/FAQPage
  JSON-LD (validated)
- D12: **public repo** github.com/gitAbid/episodekit (secrets-scanned,
  account-ids redacted); env key-availability check (none exposed)
- D13: IndexNow self-serve indexing (10 URLs, 202); GitHub Actions CI + badge;
  README demo GIF; og:image on all pages
- D14: quote-validator hardened for real-LLM punctuation (verbatim fragments
  accepted, paraphrases rejected — 62 tests); LS activation runbook
- D15: config-driven first-run UX (paste tab default until ASR live); 9:16
  vertical demo cut
- D16: pillar guide #1 (complete guide to show notes) + tool→app sessionStorage
  transcript handoff
- D17: **bug fix** — all "email us" CTAs were dead (unowned domain); working
  contact form + /api/contact (durable sk_contact log)
- D18: PH gallery assets at exact 1270×760; uptime check as daily-loop step 0;
  README sample-output block (quotes verified against generated JSON)
- D19: engine copywriting pass (6-way follow-up bank, richer apply prompts,
  pair titles)
- D20: pillar guide #2 (podcast repurposing playbook)

## Day 10 (build session 10) — 2026-10-25
- Launch pack: paste-ready PH submission + maker comment + Show HN post +
  launch-day checklist — `docs/launch-pack.md`
- `docs/METRICS.md` created (daily-loop reference): honest baseline, Vercel-log
  field guide, decision gates

## Day 9 (build session 9) — 2026-10-25
- **Demo video #1**: 38s narrated walkthrough (8 live-app frames + Ken Burns +
  crossfades + TTS + branded cards via ffmpeg/Swift), embedded on the landing,
  range-streaming verified — `site/demo.mp4`, `scripts/gen_cards.swift`
- Visual QA iterations: fixed pillarbox (full-bleed recapture) + edge strip
  (crop) — final SHIP

## Day 8 (build session 8) — 2026-10-25
- Free tool #4: **show notes generator** (money-keyword SEO page) + new API
  `mode:"article"` — `tools/show-notes.html`
- Comparison pages: vs Podsqueeze, vs Castmagic (factual, attributed,
  choose-them-first honesty) — `compare/`
- Server-side `sk_usage` events → activation measurable from Vercel logs
- Sitemap/hub/footer wiring; tests 60/60; live-verified

## Day 7 (build session 7) — 2026-10-25
- **Pivot: SermonKit → EpisodeKit** (user constraint: religion-neutral products
  only). Full rebrand, podcast vertical, new CC0 demo, religion-free test gate,
  Vercel project renamed → episodekit.vercel.app (old domain removed)
- **Payment rail built + tested**: stateless HMAC license keys,
  signature-verified Lemon Squeezy webhook, checkout config, in-app activation
  (inert until LS credentials)
- **Live sprint mind map**: /map with status-tree, decision timeline, live
  metric polling; status.json maintained by the daily build loop
- Privacy: waitlist GET now counts-only; week-1 review; podcast complaint
  lexicon + directory kit rewrites
- Tests 60/60; live e2e on new domain; visual QA SHIP on map

## Day 6 — 2026-10-24
- Waitlist capture: `/api/waitlist` + form on landing (live e2e verified)
- Landing proof: live-captured screenshots (app result, samples, pricing) with
  alt text, lazy loading, CLS-safe dimensions — `site/img/`
- Samples page: generated-from-context highlight card + try-it CTA
- Directory submission kit for 8 directories — `docs/directory-submissions.md`
- Tests 39/39; all features verified on production

## Day 5 — 2026-10-24
- **LIVE: https://sermonkit.vercel.app** — Vercel production deploy (static
  site + 3 API functions), protection disabled, project renamed to `sermonkit`,
  domain auto-attaches on deploy
- Live-verified end-to-end: all pages 200, generate-suite + track APIs working
  in prod, browser e2e paste flow on the live URL
- Lighthouse mobile: **Performance 100 / Accessibility 100 / Best Practices 96 /
  SEO 100** (a11y fixed from 89: main landmark + link contrast)
- Engine: light-verb stopwords (cleaner themes); 22+17 tests green

## Day 4 — 2026-10-24
- App v0 (paid-product core): audio upload with browser-side compression to fit
  Vercel's 4.5MB limit, transcript-paste path, full-suite result page with
  per-artifact copy + Markdown/JSON download — `site/app.html`,
  `site/js/suite-render.js`
- Provider-agnostic ASR (`api/asr.js`: Deepgram/Groq) + `api/transcribe.js`
  endpoint with coded errors and graceful paste fallback
- Free-tier counter (3/month, localStorage, beta-labeled)
- Local dev server wiring site + API functions — `scripts/dev-server.mjs`
- Tests: 22/22 engine + 17/17 ASR; browser e2e paste flow verified; visual QA SHIP

## Day 3 — 2026-10-24
- Free tool #2: sermon title generator (themes + 6 titles) — `tools/sermon-titles.html`
- Free tool #3: devotional generator (5-day series, copy export) — `tools/devotional.html`
- Tools hub page (free church communication tools) + shared `tools/tool.css`
- Analytics v0: first-party beacon + `/api/track` (no external account, no PII)
- SEO: robots.txt, sitemap.xml (6 URLs), OG/Twitter tags on all pages, canonical,
  1200×630 OG image rendered via `scripts/gen_og.swift` (visual-qa verdict: SHIP)
- API: `mode:"titles"` + `mode:"devotionals"` (deterministic, keyless)
- Engine: always-6 titles; 22/22 tests green

## Day 2 — 2026-10-24
- Sermon engine core: deterministic full-suite builder (titles, summary, manuscript,
  discussion guide, 5-day devotionals, social pack) — `engine/lib.js`
- GLM path with verbatim-quote validator + per-artifact deterministic fallback —
  `engine/glm.js`
- CLI + renderers (JSON/Markdown/HTML) — `engine/cli.js`, `engine/index.js`
- 22-test suite (`npm test`) incl. honesty tests (all quotes exact substrings)
- Marketing proof: engine-generated sample suite committed —
  `docs/samples/sample-suite.{json,md}` + rendered `site/samples.html`, linked
  from landing; demo sermon is original CC0 text
- API `mode:"full"` — full suite endpoint, keyless-capable

## Day 1 — 2026-10-24
- Research: 3 parallel agents (demand, business model, distribution) → `RESEARCH.md`
- Decision: SermonKit (church vertical, $19/mo Pro, Lemon Squeezy MoR) → `ROADMAP.md`
- Infrastructure: daily 09:00 build automation created; memory files saved
- Build: landing page v0 (`site/index.html`), free tool #1 — discussion-guide
  generator, works offline via client-side heuristics (`site/tools/discussion-guide.html`)
- Build: Vercel function `generate-suite` with GLM API path + 503 fallback to the
  offline generator (`api/generate-suite.js`) — switched to Vercel per user
  ("netlify is slow")
