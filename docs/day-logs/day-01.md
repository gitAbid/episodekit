# Day 1 — 2026-10-24

**Build commit:** `7b8853f` (repo: project-okra, branch main; this log amended in a
follow-up docs commit)

## What shipped
1. **Research → decision.** Three parallel research agents (demand scan, business
   model, distribution). Full report + sources in `RESEARCH.md`. Decision:
   **SermonKit** — sermon → full content suite, church vertical, $19/mo Pro
   (incumbents verified at $39–129/mo). Rationale and kill/pivot gates in
   `ROADMAP.md`.
2. **Infrastructure.** Daily 09:00 build automation created (id
   `automation-ee0a1f28-c6b1-49a9-823b-9cdfd225c138`), titled "Daily 9am build
   session — SermonKit". Memory files saved (goal, decisions, repo separation,
   GLM-limits policy). GLM plan-switching policy added to ROADMAP hard rules (#6).
3. **Landing page v0** — `site/index.html`: hero, how-it-works, 6-artifact grid,
   pricing (Free / Pro $19 / Studio $49 / Founder LTD note).
4. **Free tool #1 (SEO wedge)** — `site/tools/discussion-guide.html`: paste a
   sermon → discussion guide (icebreaker, opening questions, quote-anchored
   questions, prayer). Works **fully offline** via client-side heuristics; tries
   `/api/generate-suite` first and falls back silently when unconfigured.
5. **Vercel function** — `api/generate-suite.js` (switched from Netlify to Vercel
   per user: "netlify is slow"). GLM chat-completions path, 25s timeout,
   503 `ai_not_configured` when no key, `vercel.json` (site/ static + api/).

## Verification (evidence)
- Function: `node --check` pass; mock req/res → no-key POST returns 503
  `ai_not_configured`, GET returns 405.
- Pages: served locally (python http.server), landing + tool page HTTP 200; hero
  copy present; 1 reference to `/api/generate-suite`; 0 stale netlify refs.
- Heuristic generator (node harness against the page's own code): PASS on a
  ~240-word sample — all 6 quotes verified as **exact sentences from the input**
  (no invented quotes), 3 opening questions, prayer prompt; short input → null
  (guarded). Stopword fix after first run ("because" leaked into the title);
  re-test PASS: title "Discussion Guide — Forgiveness & Mercy".

## Not done / next (Day 2 start here)
- Sermon engine core (Node): transcript → full suite (manuscript, devotionals,
  social pack, summary, titles) with GLM + template fallback.
- Public-domain sample sermon + committed generated sample suite (marketing proof).
- Free tools #2/#3, analytics snippet, sitemap/robots/OG.

## Blockers
None. Needs-from-user list (Lemon Squeezy account, GLM/ASR keys) does not block
Day 2 — engine builds with deterministic fallback first.
