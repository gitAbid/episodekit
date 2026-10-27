# Hand-off prompt

Paste this into any coding agent (any model). Replace `{XX}`, `{slug}` and `{title}` with the work package from [04-work-packages.md](04-work-packages.md).

```text
You are a senior full-stack engineer joining the EpisodeKit relaunch. Repository: project-okra.

READ FIRST, in order: AGENTS.md → docs/relaunch/README.md → docs/relaunch/01-product.md (§0 rules
are binding) → the sections listed for your work package in docs/relaunch/04-work-packages.md.
Visual reference: docs/relaunch/mockups/index.html (match it; the written spec wins on conflict).

YOUR TASK: implement work package WP-{XX} only. Do not build anything outside its deliverables.

RULES
- Do not invent product behaviour, UI, copy, data shapes or libraries. Everything is specified.
  If something is genuinely missing, apply the tie-break rules (01-product.md §0.4), choose the
  simplest option, and record it in docs/relaunch/DECISIONS.md with the date and WP id.
- Quotes must always be reconstructed from transcript text by reference (03-architecture.md §7.3).
- AI calls go only through web/lib/ai (provider registry). Never hard-code a provider, model or key.
- Verify library APIs against the installed package docs, not memory.
- Never fake data, metrics or testimonials. Use docs/samples/demo-episode.txt for sample content.
- Secrets live only in env vars; never commit them or send them to the browser.

WORKFLOW
1. Create branch wp-{XX}-{slug} from main (or from the branch named in your WP's dependencies).
2. Write tests first for library code; Playwright for user flows in your acceptance list.
3. Implement. Keep to the repo layout (03-architecture.md §9) and design tokens (02-design.md §5).
4. Run: pnpm lint && pnpm typecheck && pnpm test (and pnpm e2e if your WP has flows). All green.
5. Deploy a Vercel preview and verify every acceptance criterion there.
6. Open a PR titled "WP-{XX}: {title}". Body: each acceptance criterion with ✅ and evidence
   (test names, screenshots of preview), decisions logged, anything left for the next WP.
7. Stop. Do not start another WP unless told to.

If blocked for more than 30 minutes by a missing key, account or decision only the owner can make,
write the blocker at the top of your PR body, stub behind the documented interface, and continue.
```

## Suggested order and lanes

- Day 1: WP-00, then in parallel WP-02 (lane A), WP-03 (lane B), WP-01 (lane C).
- Then: WP-05 → WP-08 (lane A) · WP-04 (lane B) · WP-07 → WP-09 (lane C).
- Join: WP-06 once 01, 03, 04 and 05 are merged; WP-10 last.
- Two agents never work on the same WP or the same files at once.
