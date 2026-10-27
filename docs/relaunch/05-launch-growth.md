# Launch, traction gates, growth, risks

> Part of the EpisodeKit MVP relaunch spec. Index: [README.md](README.md). Binding rules: [01-product.md §0](01-product.md).

## 11. MVP launch plan (≈2–3 weeks build + 2 weeks beta)
- **Week 0 (owner, 30 min)**: activate GLM coding-plan package (or accept Groq fallback); confirm Groq key in Vercel; add Neon + Clerk + Resend + PostHog via Vercel Marketplace; create LS store (test mode) or a Founding payment link; buy `episodekit.app` (optional).
- **Weeks 1–2**: WP-00…09 per lanes.
- **Week 3**: WP-10, eval gate, cutover on preview domain.
- **Beta (2 weeks)**: recruit 15–20 podcasters 1:1 (owner network, maker-disclosed replies in communities whose rules allow it, guests of indie shows). Free Pro during beta in exchange for feedback calls; offer Founding $99/yr at the end.
- **Public launch**: Show HN ("Show HN: EpisodeKit – podcast show notes where every quote is checked against the transcript", link to build story), Product Hunt 2 days later, directories (`docs/directory-submissions.md`).

## 12. Traction gates → growth roadmap
**MVP success metrics** (PostHog + DB): activation = first artifact copied within 24 h of signup (target ≥40%); weekly active shows; artifacts copied with ≤1 regenerate (≥70%); 👍 rate; paying accounts.
**Gate to Growth** (any 2 of): ≥10 shows processing ≥1 episode/week for 3 consecutive weeks · ≥5 paying accounts · ≥40% activation with ≥30 signups.
**If gate missed after 6 weeks of distribution**: run autopsy from feedback table; options are re-position (coaches/webinars — engine unchanged) or stop.
**Growth backlog, ordered by expected pull** (build only with feedback evidence):
1. Deepgram adapter + speaker names (when ≥30% ask) → 2. Guest share kit + share page (viral loop) → 3. Quote card images (`@vercel/og`) → 4. RSS episode import + auto-detect new episodes → 5. Version history + rewrite-selection + Tiptap editor → 6. Vercel Workflow durability for 3 h+ episodes → 7. Studio plan ($49, 3 shows, 3 seats) → 8. Export ZIP, chapters.json → 9. Direct publish (WordPress/Ghost/Substack), scheduling → 10. Search across episodes.

## 13. Risks
| Risk | Mitigation |
|---|---|
| GLM quality/availability (1113) | Registry + Groq fallback + admin switch; eval gate per provider |
| Groq 25 MB limit | Browser compression + 10-min chunks |
| No speaker names | Pasted transcripts keep speakers; Deepgram is a ready growth step |
| Generic output persists | Voice profile, flat schemas per artifact, eval gate, per-artifact feedback |
| Free tool abuse/cost | BotID, IP limits, daily cost cap, deterministic fallback |
| Owner bottleneck again | Owner tasks front-loaded in Week 0; everything else agent-doable; test modes |
