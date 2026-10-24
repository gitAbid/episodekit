# Research — 2026-10-24 (Day 1)

Three parallel research agents (demand scan, business model, distribution). Full agent
reports summarized here; sources inline. WebSearch was rate-limited during research, so
evidence leans on direct fetches of pricing pages, HN Algolia, Trustpilot, and the
pullpush Reddit archive. Re-verify anything load-bearing after 2026-10-29 when search
quota resets.

## 1. Demand scan

### The mass "video → clips" market is a trap
- Opus Clip $15–29/mo, Klap $14–39, Vizard credits, Recast $14–26, Eklipse $24.99–39.99.
- Riverside bundles "Magic Clips" **free** with recording. A "cheaper OpusClip clone"
  already flopped on HN (1 point, Aug 2025).
- Verified user complaints: billing/cancellation abuse (Opus Trustpilot 4.0), unusable
  clip picks (Eklipse, 971 reviews), "generic output, I rewrite most of the text"
  (r/YouTubeCreators via pullpush, June 2026), "Castmagic is expensive and overwhelming"
  (r/SideProject, May 2026).

### Verticals price 2–4× for the same capability
| Vertical | Incumbent | Price | Notes |
|---|---|---|---|
| **Church sermons** | [Pulpit AI](https://www.pulpitai.com/pricing) | **$39–129/mo** (5–25 uploads) | Only ~2 real incumbents |
| **Church sermons** | [Sermon Shots](https://sermonshots.com/pricing/) | **$63–97/mo** | Too new for review history |
| Podcasters | Podsqueeze $9–89, Castmagic $19–699 | mid | Complaints: generic, pricey |
| Coaches | Upheal $39–99, CoachAccountable $20+ | mid | Clinical-centric gaps |
| Home inspectors | Spectora **$109/mo** (report software) | high | Voice-draft wedge unverified |

**Rank 1: sermon content suite** — verified 2–4× pricing, weekly recurring need (every
Sunday), low churn, buyer is pastor/comms-volunteer, channels an agent can work
(SEO tool pages, directories, PH; Facebook groups are NOT agent-workable — noted gap).
**Rank 2: podcast suite** (same engine; slower SEO). **Rank 3: inspection voice reports**
(weakest complaint evidence, longest build).

### Killed
Generic clip tools (saturated, price-floored, free bundling), streamer clips (broke
buyers, hardest problem), student study tools (churn + incumbency), meeting notes
(free-tier giants).

## 2. Business model (agent-operated, month-1 honest)

- **Winner: freemium web micro-SaaS, usage credits, Lemon Squeezy (MoR, 5% + 50¢)**
  — MoR handles global sales tax; raw Stripe is a compliance sink for an async operator.
- Realistic month-1: **$0–500 typical, $300 target, $800 strong-launch stretch**.
  Free-trial→paid 2–5%, freemium 1–4%, SMB churn 3–7%/mo (memory-based benchmarks —
  re-verify post 2026-10-29).
- Usage-credit free tier beats time-boxed trial (trials expire while the agent sleeps;
  credits self-ration and cap LLM cost). Guardrail: free-tier cost < $0.50/user/mo.
- Stack a one-time **Founder LTD $49 (first 50)** for launch-week cash + testimonials.

### v1 pricing
| Tier | Price | Contents |
|---|---|---|
| Free | $0 | ~3 sermons/mo, watermarked, core suite |
| Pro | **$19/mo** / $190/yr | 12 sermons/mo, full suite, no watermark |
| Studio | **$49/mo** | 40 sermons/mo, batch, priority, API |
| Founder | $49 once, first 50 | Pro-for-life, retires after |

### Day-1 metrics to instrument
1. Activation: signup → first successful output < 10 min (target ≥40%)
2. Free→paid by weekly cohort, split by source (target ≥2–3% by week 4)
3. Gross margin per active user (credits × unit cost vs revenue)

## 3. Distribution (agent-executable, legitimate)

- **Constitution**: no fake reviews (FTC 16 CFR 465), no vote-buying, no spam;
  disclose maker identity when sharing; Google scaled-content policy bans thin
  mass pages — every page must do real work.
- **What still works 2026**: free *tool* pages (not explainer posts), comparison
  pages, directories (backlinks + LLM-corpus presence = your "GEO"), Show HN (only
  if instantly playable, no signup wall), niche-subreddit 1:1 replies (free tools
  only), YouTube Shorts demos (agent can generate these with the video kit).
- **What's dead**: informational SEO at scale (Pew: 8% CTR with AI summaries;
  Ahrefs: −34.5% position-1 CTR on AI-Overview keywords), PH badge traffic era,
  AI content farms, engagement pods.
- **First 10 paying customers**: 15–25 complaint-lexicon phrases → camp where the
  pain is discussed → free no-signup tool as the wedge → 10–20 genuine replies/day,
  solution inline, maker-disclosed → convert in-product. Honest math: 450 touches →
  30–80 signups → 3–15 paid in month 1.
- **Analytics ($0)**: PostHog free (1M events/mo), Cloudflare Web Analytics, GSC,
  Ahrefs Webmaster Tools; append-only daily log (template in docs/METRICS.md).
- 30-day calendar: see ROADMAP.md.

## Decision (recorded in ROADMAP.md)

**SermonKit**: one sermon upload → full content suite, launched into the church
vertical at $19/mo (undercutting Pulpit AI's $39), engine vertical-agnostic so a
podcast/coach pivot is a landing-page change, not a rebuild.

## Addendum — Day 7 pivot (2026-10-24)

User set a hard constraint: **no religious-domain products** ("can't carry that
one"). SermonKit's church positioning is therefore retired. Pivot target =
Day-1 research's rank-2: **podcasters** — Podsqueeze $9–89/mo, Castmagic
$19–699/mo (verified Day 1), complaints "generic output / expensive /
overwhelming" (r/YouTubeCreators + r/SideProject via pullpush, May–Jun 2026).
Wedge unchanged: verbatim-quote honesty + keyless deterministic engine +
free-tool SEO. All church/sermon copy, demo content, and branding were removed
and a permanent test gate now asserts religion-free output.
