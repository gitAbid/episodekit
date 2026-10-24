# SermonKit — 30-Day Roadmap (2026-10-24 → 2026-11-24)

**One sermon upload → a month of content.** Edited manuscript, discussion guide,
devotional emails, social captions + pull quotes, sermon summary, titles — generated
from audio or a YouTube link.

## Why this product (see RESEARCH.md)
- Verified incumbents charge $39–129/mo for this exact job (Pulpit AI, Sermon Shots).
- We enter at **$19/mo** — 2× margin room below the floor of the vertical's pricing.
- Weekly recurring need (every Sunday), low churn, solo decision-maker.
- Engine is vertical-agnostic: podcast/coach pivots = new landing page only.
- The build agent can also generate demo videos and sample artifacts daily —
  marketing materials are a byproduct of the engine itself.

## Hard rules (all sessions, including scheduled runs)
1. **Never fake progress, metrics, or testimonials.** Every changelog line maps to a
   commit. Testimonials only with real permission (FTC).
2. No spam, no vote-buying, no fake accounts. Maker-disclosed sharing only.
3. Every user-facing claim must be true of the shipped product today.
4. Ship something verifiable every day: a commit, a deployed change, or a published
   artifact — logged in docs/day-logs/ and CHANGELOG.md.
5. If blocked on an item >2 hours, log the blocker, move to the next item.
6. **GLM limits (user-authorized, 2026-10-24):** when a GLM plan/model hits its
   limit, switch to another available plan/model as needed. If all are exhausted,
   continue with offline/deterministic work and schedule a one-shot automation to
   resume the blocked step at the next reset. Log every switch in the day log.

## Status legend: [ ] todo · [~] in progress · [x] done (with commit hash)

## Week 1 (Days 1–7): Foundation + free-tool wedge
- [x] D1: Research, decision, roadmap, repo scaffold, landing v0, free tool #1
      (discussion-guide generator, works offline via heuristics) — commit `117a611`
- [ ] D2: Sermon engine core (Node): transcript → suite generator (GLM via env key;
      deterministic template fallback when no key). Sample sermon in repo (public
      domain) + generated sample suite committed as marketing proof.
- [ ] D3: Free tool #2 (sermon title generator) + free tool #3 (devotional generator);
      each with its own SEO page + meta. Analytics snippet (PostHog or Cloudflare).
- [ ] D4: App v0: upload audio (m4a/mp3) → ASR (Deepgram/Groq via env key; graceful
      "transcript paste" fallback) → suite result page + copy/download buttons.
- [ ] D5: Vercel deploy (site + api functions), custom domain if provided; sitemap,
      robots, OG images. Verify Lighthouse ≥90 on landing.
- [ ] D6: Pricing page, waitlist capture, docs/samples page with the generated suite.
- [ ] D7: Buffer/catch-up + Week-1 review in docs/day-logs/week-1-review.md.

## Week 2 (Days 8–14): Payments + launch prep
- [ ] Lemon Squeezy: products (Pro/Studio/Founder-LTD), checkout links, webhook →
      license keys. **Requires user to create LS account (see "Needs from user").**
- [ ] Credits + paywall on the app; free tier = 3 sermons/mo watermark.
- [ ] Landing polish with real sample artifacts + screenshots.
- [ ] Demo video #1 (agent-generated with the video kit): "paste sermon → full suite
      in 2 minutes" for YouTube Short / PH gallery.
- [ ] Directory batch #1: BetaList (pre-launch), AlternativeTo, There's An AI For
      That, SaaSHub, Indie Hackers, Futurepedia, DevHunt queue.
- [ ] Comparison pages: "SermonKit vs Pulpit AI", "vs Sermon Shots" (honest, verified
      facts only).
- [ ] Community: complaint-lexicon doc (15–25 phrases); start genuine 1:1 replies
      where rules allow (Reddit subs that permit tool sharing; HN comments).

## Week 3 (Days 15–21): Launch week
- [ ] Show HN (only when the free tool is instantly usable with no signup).
- [ ] Product Hunt launch (Tue–Thu; gallery, 60s demo, maker comment, promo widget).
- [ ] DevHunt / Uneed staggered launch.
- [ ] Founder LTD $49 × 50 pushed to waitlist + launch traffic.
- [ ] Daily: answer every comment for 48h post-launch; log metrics.

## Week 4 (Days 22–28): Compound + harden
- [ ] Activation fixes from PostHog funnels (target ≥40% first-output-in-10-min).
- [ ] v2 engine: audio clips + quote graphics (ffmpeg) if unit economics allow;
      otherwise deepen text suite quality (A/B prompt packs per artifact).
- [ ] 5 user interviews (async email) → top-3 requested artifacts built.
- [ ] First churn check; founder-touch onboarding emails to every signup.

## Day 29–30: Month-one report
- [ ] Public "month one, all numbers" post (the transparency post earns links).
- [ ] Month-2 plan: SEO compounding, extension/API decision, possible vertical #2.

## Kill/pivot criteria (honesty gates)
- <10 activated free users by Day 14 → double distribution effort, delay paywall.
- 0 paying customers by Day 24 despite ≥200 activated free users → pricing/positioning
  autopsy; consider podcast-vertical repositioning (same engine).
- ASR+LLM unit cost > $1.00/sermon → cut free tier to 1 sermon/mo before losing money.

## Needs from user (none block daily progress)
- Lemon Squeezy account (payout rail; needed ~Day 8)
- API keys via Vercel env when available: `GLM_API_KEY` (text suite),
  `ASR_API_KEY`/`ASR_PROVIDER` (Deepgram or Groq; audio path)
- Optional: custom domain (~$10–20/yr); else sermonkit.netlify.app
- Optional: PostHog account for funnels; else Cloudflare Web Analytics only

## Stack (chosen for agent-operability + $0 base cost)
- Static site (vanilla HTML/CSS/JS, no build step) + Netlify Functions (Node).
- Server suite-generator: GLM chat completions (OpenAI-compatible endpoint) with a
  deterministic template fallback so every page works keyless.
- ASR: provider-agnostic server function (Deepgram/Groq/Whisper-compatible).
- Payments: Lemon Squeezy (MoR). Analytics: PostHog/Cloudflare. Hosting: Vercel
  (static from `site/`, functions from `api/`; user chose Vercel over Netlify).

## Daily cadence (automation: 09:00 local, every day)
1. Read ROADMAP.md + latest docs/day-logs/ + CHANGELOG.md.
2. Pick the highest-priority unfinished item; build/verify it (test in browser where
   possible). One marketing action from the GTM sections.
3. Commit with a clear message; update CHANGELOG.md; write docs/day-logs/day-NN.md
   (what shipped, evidence, what's next). Log metrics if any exist.
4. Never mark items [x] without the commit/deploy evidence.
