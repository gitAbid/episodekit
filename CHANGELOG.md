# Changelog

All entries map to a commit. Newest first.

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
