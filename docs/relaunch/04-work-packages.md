# Work packages

> Part of the EpisodeKit MVP relaunch spec. Index: [README.md](README.md). Binding rules: [01-product.md §0](01-product.md).

## 10. Work packages (MVP)
**Every WP**: branch `wp-XX-slug`; read §0 + listed sections; TS strict, ESLint, Prettier; Vitest for lib code, Playwright for flows; log tie-breaks in DECISIONS.md; PR lists acceptance with evidence. **Done** = criteria pass on a Vercel preview + `pnpm lint typecheck test` green.

| WP | Title | Depends | Sections | Deliverables | Acceptance |
|---|---|---|---|---|---|
| 00 | Scaffold | — | 9 | `web/` Next.js, pnpm, Tailwind v4, shadcn, Vitest, Playwright, CI, `AGENTS.md` | preview deploy renders; CI green |
| 01 | Tokens + components | 00 + mockups | 5 | `globals.css`, shadcn theme, custom components, `/dev/components` (dev only) | all §5.3 components light/dark, axe 0 |
| 02 | DB + auth + show | 00 | 7.1, M1, M9 | Drizzle schema/migrations, Clerk + webhook, onboarding steps 1 & 3 shell, settings General | U1, U2 |
| 03 | Engine port + quotes + schemas | 00 | 7.2–7.3, 8.4 | `lib/engine` (TS port of `engine/lib.js`), `lib/quotes`, `lib/artifacts`, ported tests + religion gate + property test | all green |
| 04 | AI provider registry + prompts | 03 | 8.1, 8.2, 7.4 | `lib/ai` adapters/presets/fallback/cost, all prompts, voice learn/preview, admin AI API | U8, U10, U18; live test with GLM and Groq keys |
| 05 | Intake + ASR | 02 | M2, M3, 8.3 | browser compression+chunking (port from `site/app.html`), Blob upload, transcript parsers (txt/SRT/VTT/Riverside/Descript/Otter), Groq adapter, segment merge | U4, U5, U19; fixtures per format |
| 06 | Orchestration + workspace UI | 01, 03, 04, 05 | M4–M8, MK-5/6/7 | step routes, polling, processing view, workspace with all artifact layouts, quotes panel + popover + audio, edit/autosave, regenerate/undo, copy presets, download .md, ready flags, episodes list | U6, U7, U9, U11–U13; Playwright desktop + mobile on sample episode |
| 07 | Voice onboarding + settings | 02, 04, 01 | M1, M9, MK-2/8 | step 2 UI, Voice settings page | U3 |
| 08 | Billing + quota | 02 | M10, MK-9 | entitlements helper, quota wall, LS checkout + webhook + cancel, manual plan flag in admin, founding counter | U14, U15 in LS test mode |
| 09 | Marketing + free tools + admin + feedback | 01, 04 | M11–M13, MK-1/10/11 | landing, pricing, privacy/terms, port tools/compare/guides/templates/samples at same URLs, BotID + limits, `/admin`, feedback widget, PostHog events | U16, U17 (URL parity script over old `site/sitemap.xml`), Lighthouse ≥95 |
| 10 | Evals + cutover | all | 11 | `evals/` (8 transcripts: demo + self-recorded/CC0: interview, solo, 3-person, jargon-heavy), runner, move legacy, switch Vercel root, env check script (port `scripts/verify-unlocks.mjs`) | eval gate below; launch checklist |

Parallel lanes: **A** 00 → 02 → 05 → 08 · **B** 03 → 04 · **C** mockups → 01 → 07 → 09 · join at 06 → 10.
Eval gate: quote integrity 100% · banned-word leaks 0 · limit compliance ≥98% · LLM-judge (different provider than generator) faithfulness ≥4.3/5, usefulness ≥4.0 · owner "would publish with light edits" on ≥4 of 5 packages · p90 60-min episode ≤5 min · cost ≤$0.50/episode.
