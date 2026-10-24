# SermonKit

**Live: <https://sermonkit.vercel.app>** — deployed on Vercel (auto-deploys from
this repo's `main` via `vercel --prod`; env vars set in the Vercel dashboard).

**One sermon → a month of content.** SermonKit turns a Sunday sermon (audio file or
transcript) into the full content package a church communications volunteer spends
hours writing every week: an edited manuscript, small-group discussion guide,
devotional email drafts, social captions with pull quotes, a summary, and title
suggestions.

- Positioning/pricing: Pro **$19/mo** (incumbents Pulpit AI $39–129/mo, Sermon Shots
  $63–97/mo) — see `RESEARCH.md`.
- Plan: `ROADMAP.md` · daily log: `docs/day-logs/` · changelog: `CHANGELOG.md`.
- Sprint: 2026-10-24 → 2026-11-24, one autonomous build session every day 09:00.

## Layout

```
site/                 # static site, no build step (landing, pricing, free tools)
  tools/              # free no-signup tool pages (SEO wedge)
api/                  # Vercel serverless functions (suite generator, ASR bridge)
docs/                 # day logs, metrics, samples
```

## Develop

Any static server works, e.g.:

```bash
cd site && python3 -m http.server 8080
```

Functions are Vercel serverless functions (Node). Deploy by connecting this repo to
Vercel, or:

```bash
vercel --prod
```

## Env vars (optional; pages degrade gracefully without them)

- `GLM_API_KEY` — GLM chat completions (text suite quality upgrade)
- `ASR_API_KEY` / `ASR_PROVIDER` — audio transcription (Deepgram or Groq)
- `LS_PRODUCT_IDS` — Lemon Squeezy checkout links (payments, from Day 8)

Set them in Vercel → Project → Settings → Environment Variables.

## Rules for agents working here

See "Hard rules" in `ROADMAP.md` — no fabricated progress or testimonials, no spam,
evidence-backed changelog entries only.
