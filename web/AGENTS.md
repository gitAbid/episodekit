# EpisodeKit web app

This directory is the new Next.js app from the MVP relaunch spec. Before writing
any code here, read, in order:

1. Repo root `AGENTS.md` → `docs/relaunch/README.md` → `docs/relaunch/01-product.md` §0 (binding).
2. The sections listed for your work package in `docs/relaunch/04-work-packages.md`.
3. `docs/relaunch/03-architecture.md` §9 for the layout of this directory (app/, components/, db/, lib/, tests/).

Hard rules (short form): never fake metrics/testimonials; quotes are reconstructed
from transcript text by reference, never from model text; AI calls only through
`lib/ai` (provider registry); secrets only in env vars; log tie-break decisions in
`docs/relaunch/DECISIONS.md`.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on http://localhost:3000 |
| `pnpm lint` | ESLint (flat config, eslint-config-next) |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm test` | Vitest unit tests (`tests/unit/`) |
| `pnpm e2e` | Playwright flows (`tests/e2e/`, auto-starts dev server) |
| `pnpm build` | Production build |

All of lint + typecheck + test must be green before opening a PR.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
