# Decisions log

Agents append one entry per tie-break decision (01-product.md §0.4). Newest first.
Format: `YYYY-MM-DD · WP-XX · decision · why · alternatives considered`.

- 2026-10-27 · WP-00 · Scaffold on current stables: Next.js 16.4.3, React 19.3, Tailwind v4.3.3, TS 5.9 strict, pnpm 12 · §0.4 rule 1 (boring, documented defaults at build time) · pinning older Next 15 LTS-style
- 2026-10-27 · WP-00 · shadcn initialized with `radix` base + `nova` preset (Lucide icons, Geist), baseColor neutral as placeholder · locked decision says "shadcn/ui + lucide"; radix is the classic shadcn primitive set; WP-01 ports the §5.2 tokens over the neutral defaults · `base`/`aria` primitive sets
- 2026-10-27 · WP-00 · `pnpm e2e` = `pnpm build && playwright test` with webServer `next start` (production build), not dev server · deterministic; runner-spawned dev server hung in this environment, and Playwright docs recommend testing a production build · webServer `pnpm dev` (dev remains for interactive use)
- 2026-10-27 · WP-00 · Placeholder home page uses verbatim spec copy (§0.2 positioning + MK-1 hero) plus a plain "scaffold placeholder" line; real landing ships in WP-09 · §0.4 rule 4 (no invented copy) and it gives CI/e2e something real to assert · blank page
- 2026-10-27 · WP-00 · Vercel previews for `web/` go to a NEW project `episodekit-web` (framework nextjs, SSO deployment protection disabled — no secrets, internal project); the existing `project-okra` project (legacy site, root directory) stays untouched until WP-10 cutover · protects the live product; spec moves Vercel root only at cutover · linking web/ into the existing project now
- 2026-10-27 · WP-00 · CI: `web` job (pnpm, lint/typecheck/test/build/e2e-chromium) added to the existing `.github/workflows/ci.yml`; legacy `test` job unchanged · one workflow, both products gated on every PR · separate workflow file
- 2026-10-27 · spec · Groq Whisper for MVP transcription; Deepgram deferred · speaker labels are not needed for the first paying clients, and Groq is ~6× cheaper and already configured · Deepgram nova-3 now

- 2026-10-27 · spec · GLM Coding Plan is the default LLM, Groq the fallback, behind a provider registry · owner preference; keeps provider switchable by env/admin · AI Gateway only
- 2026-10-27 · spec · Client-orchestrated pipeline instead of a durable workflow engine · fewer moving parts for the MVP; each step is idempotent and resumable from DB state · Vercel Workflow
