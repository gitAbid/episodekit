# Metrics Log — EpisodeKit (append daily, honest numbers only)

Sources: live `/api/track` + `/api/waitlist` (per warm instance; durable history
in Vercel function logs: `sk_event`, sk_waitlist`, `sk_usage`, `sk_license`).
Note: these per-instance counters reset when functions cold-start — the
authoritative record is the function log (Vercel dashboard → Logs, filter by
tag). Pageviews include the build agent's own verification hits until
distribution starts; treat all pre-launch numbers as engineering telemetry.

| Date | Pageviews | Visitors | Waitlist | sk_usage (tool/API calls) | Notes |
|---|---|---|---|---|---|
| 2026-10-24 | 3 | 3 | 2 (both agent tests) | — | Day-5 deploy verification only; zero distribution |
| 2026-10-25 | 2* | 2* | 0* | ~15 (agent e2e) | *new warm instance post-rename; all values are agent verification hits. Distribution still zero — no directory/GSC/community activity yet (all gated on user accounts) |

## Revenue
$0 — payment rail built and tested; inert until the Lemon Squeezy account
exists (see ROADMAP "Needs from user").

## Reading the Vercel log (when needed)
- `sk_event` — pageview beacons (path, referrer host, visitor id)
- `sk_usage` — every generate-suite call (mode + words): activation signal
- `sk_waitlist` — email signups
- `sk_license` — license issues/validations (payments live)

| 2026-10-28 21:00 | 0 (log) | — | 0 | 0 | contact:0 licenses:0 | A2 day: HN submission not posted |

**Decision gates (from ROADMAP):** <10 activated free users by Day 14 despite
distribution → distribution autopsy; 0 paying by Day 24 despite ≥200 activated
→ pricing/positioning autopsy + podcast→other-vertical pivot evaluation.
