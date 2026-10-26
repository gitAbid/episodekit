# EpisodeKit — 7-Day Launch Sprint (2026-10-27 → 2026-11-02)

**TIMELINE CHANGE (user request, 2026-10-26):** sprint compressed from 30 days
to **7 days ending 2026-11-02**. The build phase (21 sessions, Oct 24–26)
already delivered everything the original plan scheduled through week 3 —
product (62 tests), full SEO surface, demo videos (landscape + vertical),
payment rail, launch drafts — so these 7 days are pure launch execution.
Daily 09:00 sessions continue unchanged; day-logs keep session numbering
(next: 22). History: docs/day-logs/ + CHANGELOG.md.

**PIVOT (Day 7, 2026-10-24):** repositioned from SermonKit (church vertical) to
**EpisodeKit (podcasters)** per a hard user constraint: religion-neutral only.
Same engine; artifacts: article/show notes, discussion kit, 5-day email series,
social pack, summary, titles. Permanent test gate: religion-free output.
Live: **https://episodekit.vercel.app** · sprint map: **/map**.

**One episode upload → a month of content** — audio or transcript in, six
artifact families out, every quote verbatim.

## Why this product (see RESEARCH.md + its Day-7 addendum)
- Podcast repurposing incumbents verified at $9–699/mo (Podsqueeze, Castmagic);
  complaints: generic output, price, overwhelm.
- Our wedge: verbatim-quote integrity (AI-paraphrased quotes rejected at
  generation time) + keyless deterministic engine + free no-signup tools.
- $19/mo Pro; $49 founding (first 50); Free 3 eps/mo while in beta.

## Hard rules (all sessions, including scheduled runs)
1. **Never fake progress, metrics, or testimonials.** Every changelog line maps
   to a commit. Testimonials only with real permission (FTC).
2. No spam, no vote-buying, no fake accounts. Maker-disclosed sharing only.
3. Every user-facing claim must be true of the shipped product today.
4. Ship something verifiable every day; log it in docs/day-logs/ AND
   CHANGELOG.md (changelog upkeep is mandatory — it drifted once; never again).
5. If blocked >2 hours, log the blocker, move to the next item.
6. **GLM limits (user-authorized):** switch plans/models on limit hits; if all
   exhausted, continue deterministic/offline work and schedule a one-shot
   resume at reset. Log switches.

## The 7 days

### A1 — Mon 2026-10-27: Unlock + freeze
- [x] Agent: pre-launch freeze + full verification (executed early, session
      24, 2026-10-25: uptime 5/5, all 4 generation modes 200 live, transcribe
      503 correct, paymentsEnabled/audioEnabled false as expected, CJK guard
      400, tests 62/62 — day-24 log).
- [ ] **USER (critical path, ~15 min, docs/FOR-ABID.md + ls-runbook):** Lemon
      Squeezy account + LS env vars; GLM_API_KEY + ASR_API_KEY in Vercel →
      then agent verifies via `node scripts/verify-unlocks.mjs` (audio e2e with a
      synthesized voice sample) + LS test order per runbook §7.
- If user actions not done: everything else proceeds; launch dates hold only if
  unlocks land by A2 morning (Show HN can go first without payments; PH needs
  checkout).

### A2 — Tue 2026-10-28: Show HN
- Submit from docs/launch-pack.md (free-tool link, technical first comment).
- Answer every comment for 48h; log traffic/sk_usage hourly; fix anything the
  traffic breaks.

### A3 — Wed 2026-10-29: Distribution day
- Directories (kit ready), GSC sitemap + rich-results check, first 1:1 value
  replies from docs/complaint-lexicon.md (rules: 2-week account age, disclosure).

### A4 — Thu 2026-10-30: Product Hunt
- Launch per launch-pack (gallery assets at 1270×760 in docs/launch-assets/).
- Maker comment in 2 min; founding-member push to waitlist; answer all day.

### A5 — Fri 2026-10-31: Feedback hardening
- Fix top 3 issues from launch traffic; publish Shorts (vertical demo ready)
  if accounts exist; second comparison page if competitors appear in threads.

### A6 — Sat 2026-11-01: Compound
- Content refresh from real questions (FAQ/schema updates), any engine quality
  fixes from real usage, waitlist → founding conversion follow-ups.

### A7 — Sun 2026-11-02: Sprint report
- Honest all-numbers report (METRICS.md final); public "7 days, all numbers"
  post draft; recommendation for the next 30 days (continue / pivot vertical /
  double down).

## Kill/pivot gates (compressed)
- No user unlocks by A2 morning → launch anyway with free-tier story; payments
  attach when they land (the app handles LS-absent gracefully).
- <50 activated free users by end of A4 despite launches → distribution
  autopsy before A5; consider direct 1:1 outreach pivot.
- 0 paying customers by A7 despite ≥100 activated → pricing/positioning
  autopsy; recommendation in the A7 report (podcast→coach/vertical pivot is a
  landing-page change).

## Needs from user (unchanged, now the critical path)
1. Lemon Squeezy account (~15 min runbook)
2. GLM_API_KEY / ASR_API_KEY in Vercel env
3. Show HN / Product Hunt / directory / GSC accounts
4. Optional: episodekit.app domain

## Daily cadence (automation: 09:00 local, every day)
0. **Uptime check (first, always):** `/` → 200, `/tools/show-notes.html` → 200,
   `/api/config` → 200 JSON, POST `/api/generate-suite` (mode titles) with the
   EXACT body below (≥4 sentences — shorter probes trip the input guards and
   false-flag an incident): `{"mode":"titles","text":"focus is the most expensive resource in modern work and nobody budgets attention like money. a calendar block is a promise while a to-do item is a wish. one notification can tax the whole morning because attention compounds. subtraction beats addition when choosing tools. the professional with three tools out-ships the one with thirty."}`
   Healthy → continue silently. Failure → diagnose, fix (redeploy usually),
   re-verify, log incident in the day log first.
1. Read ROADMAP.md + latest docs/day-logs/ + CHANGELOG.md.
2. Execute the current A-day's items; if user-side items are still blocked,
   do the day's agent-side work and note the blocker.
3. Update site/status.json (map data: branches, decisions, next-up, counts —
   and keep `sprint.end`/`sprintDays` in sync) + CHANGELOG.md entry. Deploy if
   anything user-facing changed.
4. Commit with a clear message; write docs/day-logs/day-NN.md (what shipped,
   evidence, next session's start point). Log metrics in docs/METRICS.md.
