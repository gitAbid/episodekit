# Changelog

All entries map to a commit. Newest first.

## Day 1 — 2026-10-24
- Research: 3 parallel agents (demand, business model, distribution) → `RESEARCH.md`
- Decision: SermonKit (church vertical, $19/mo Pro, Lemon Squeezy MoR) → `ROADMAP.md`
- Infrastructure: daily 09:00 build automation created; memory files saved
- Build: landing page v0 (`site/index.html`), free tool #1 — discussion-guide
  generator, works offline via client-side heuristics (`site/tools/discussion-guide.html`)
- Build: Vercel function `generate-suite` with GLM API path + 503 fallback to the
  offline generator (`api/generate-suite.js`) — switched to Vercel per user
  ("netlify is slow")
