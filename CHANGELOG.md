# Changelog

All entries map to a commit. Newest first.

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
