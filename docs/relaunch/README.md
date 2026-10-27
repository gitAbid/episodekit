# EpisodeKit MVP relaunch — spec index

Goal: ship a small, working MVP a podcaster would pay $19 for, get 10 real shows using it
weekly, then grow only what traction proves. Approved by the owner on 2026-10-27.

| File | What's in it |
|---|---|
| [01-product.md](01-product.md) | §0 binding decisions and rules, problems, personas, MVP features (M1–M13), user stories (U1–U19) |
| [02-design.md](02-design.md) | §5 UX principles, tokens, components, routes, screen specs, states · §6 copy deck |
| [mockups/index.html](mockups/index.html) | Visual reference for every MVP screen (desktop/mobile, light/dark) |
| [03-architecture.md](03-architecture.md) | §7 schema, artifact shapes, quote-by-reference, API routes · §8 AI provider registry, prompts, Groq ASR · §9 repo layout, env, security |
| [04-work-packages.md](04-work-packages.md) | §10 WP-00…WP-10 with dependencies, deliverables, acceptance, lanes, eval gate |
| [05-launch-growth.md](05-launch-growth.md) | §11 launch plan · §12 traction gates and growth backlog · §13 risks |
| [HANDOFF-PROMPT.md](HANDOFF-PROMPT.md) | Prompt to paste into any agent to build one WP |
| [TRACEABILITY.md](TRACEABILITY.md) | Story → feature → mockup → WP |
| [DECISIONS.md](DECISIONS.md) | Log of tie-break decisions agents make while building |
| [BACKLOG.md](BACKLOG.md) | Ideas that are out of MVP scope |

Precedence when documents disagree: owner's words → 01-product.md §0 → the other spec files → mockups.

Key choices in one glance: Next.js + Neon + Clerk + Vercel Blob · Groq Whisper for transcription
(Deepgram later, only if speaker names are demanded) · AI through a switchable provider registry,
default GLM Coding Plan, Groq as fallback, deterministic engine as last resort · Lemon Squeezy.
