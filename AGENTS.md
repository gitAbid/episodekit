# AGENTS.md

EpisodeKit is being rebuilt as an MVP. The full, binding spec is in `docs/relaunch/`.

Start here:
1. `docs/relaunch/README.md` — index and precedence.
2. `docs/relaunch/01-product.md` §0 — decisions and hard rules (binding).
3. Your work package in `docs/relaunch/04-work-packages.md` and the sections it lists.
4. Visual reference: `docs/relaunch/mockups/index.html`.
5. The prompt you were given is in `docs/relaunch/HANDOFF-PROMPT.md`.

Repo map during the rebuild:
- `site/`, `api/`, `engine/` — the current live product. Don't change it; it moves to `legacy/` at cutover (WP-10).
- `web/` — the new Next.js app (created in WP-00).
- `docs/relaunch/` — spec, mockups, decisions log, backlog.

Hard rules (short form): never fake metrics or testimonials; quotes are reconstructed from the
transcript by reference, never from model text; AI calls only through `web/lib/ai`; secrets only
in env vars; anything out of scope goes to `docs/relaunch/BACKLOG.md`; log tie-breaks in
`docs/relaunch/DECISIONS.md`.
