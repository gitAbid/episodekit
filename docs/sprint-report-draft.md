# A7 Public Post — DRAFT (fill launch-week numbers on Nov 2)

*The transparency post for HN/Indie Hackers/PH comments. Every fixed fact
below is verifiable in the repo; blanks are launch-week numbers only. Tone:
numbers first, no hype.*

---

**Title:** I let an AI agent build and launch a SaaS in 10 days — here are all the numbers

**Body:**

On Oct 24 I gave an autonomous coding agent one instruction: research what
can make money, build it, and improve it every day on a schedule. Ten days
later — here's everything, including the parts that didn't work.

**What it built:** EpisodeKit — one podcast episode in, a month of content
out (article-style show notes, community discussion kit, 5-day email series,
social pack with pull quotes, titles). The wedge: every quote is validated as
a word-for-word substring of your transcript — the engine rejects its own AI
output if it paraphrases. Live: https://episodekit.vercel.app · source, day
logs, and the live sprint map: https://episodekit.vercel.app/map

**The numbers:**
- Build: ___ autonomous sessions, ___ commits, ___ tests (67 passing at
  freeze), first deploy on day 1 of the sprint
- Cost: $0 infra (Vercel hobby) + ~$___ TTS/API spend
- Revenue: $___ (___ founding members at $49, ___ subscriptions at $19)
- Users: ___ activated free users (ran ≥1 generation) · conversion ___%
- Traffic: Show HN ___ visits (position ___), Product Hunt ___ upvotes
  (rank ___), ___ from directories/search
- The embarrassing ones: $0-revenue days: ___ · biggest single day: ___
  pageviews · waitlist that never converted: ___

**What worked:**
1. Vertical research before building — incumbents' own pricing pages priced
   the category; we entered at half the floor.
2. Deterministic-first engineering — the product works with zero API keys,
   which meant the launch never waited on infrastructure.
3. The verbatim-quote validator as the marketing story. People don't share
   "another AI tool"; they share the one that architecturally can't invent
   your guests' words.

**What didn't:**
1. Every distribution channel required an account only the human could
   create — the agent's whole launch week was gated on ~15 minutes of
   human setup. (If you're copy this playbook: do the account setup on
   day one, not day eight.)
2. ___ [launch-week surprise]
3. ___ [launch-week surprise]

**The honest current state at posting:** ___ [one sentence: e.g., "12
paying customers, $___ MRR, here's what month two looks like" OR "zero
revenue because the unlocks landed late — the machine is live and the
founding offer stands"].

Everything above is reproducible from the repo's day logs. Ask me anything —
including the failures.

---
*Fill blanks from docs/METRICS.md, LS dashboard, and the A-day logs. Post on
Nov 2 per ROADMAP A7; also link from README + /map.*
