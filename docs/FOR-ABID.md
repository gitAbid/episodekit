# FOR ABID — Your 5 actions (everything else is automated)

The machine is built, tested (62/62), live, and self-monitoring. Five things
only you can do — each unlocks a specific capability the same morning:

## 1. Lemon Squeezy (~15 min) → payments live
Follow **`docs/ls-activation-runbook.md`** top to bottom (exact clicks, prices,
webhook URL, env vars). Result: checkout buttons render on the site, buyers
get license keys automatically, the $49 founding offer goes live.
*Skip-test: after setup, the runbook's step 7 verifies end-to-end in 2 min.*

## 2. API keys (2 min) → AI + audio live

> ⚠️ **Status 2026-10-27 PM: the current `GLM_API_KEY` on the `episodekit` project is NOT a
> real key** (11 characters, every endpoint returns 401 "token expired or incorrect"), and
> `ASR_API_KEY` is likewise a placeholder that Groq rejects. Both the legacy app and the new
> `web/` app are running on the deterministic fallback because of this. Paste the real keys
> (GLM: z.ai/bigmodel.cn console → API keys, format `id.secret`, ~100+ chars; Groq:
> console.groq.com → API Keys) into BOTH Vercel projects (`episodekit` and `episodekit-web`).

Vercel dashboard → project **episodekit** → Settings → Environment Variables:
- `GLM_API_KEY` (bigmodel.cn) → AI-enhanced artifacts activate
- `ASR_API_KEY` + `ASR_PROVIDER` (`deepgram` or `groq`) → audio upload activates
Then Deployments → ⋯ → Redeploy. The app flips itself to audio-first
automatically (config-driven — no code change). **Verify both unlocks in one
command:** `node scripts/verify-unlocks.mjs`.

For the new app also set on **episodekit-web**: `GLM_API_KEY` and (for Groq Whisper
transcription per the new spec) `GROQ_API_KEY`.

## 3. Show HN (Tue A2) → first traffic
Copy-paste from **`docs/launch-pack.md` §2** (title, the free-tool URL, first
comment). Answer comments for 48h — the map will show traffic by referrer.

## 4. Product Hunt (Thu A4) → launch day
**`docs/launch-pack.md` §1**: gallery files are ready at exact spec in
`docs/launch-assets/`, maker comment is pre-written, checklist at the bottom
of the section.

## 5. GSC + directories (Wed A3, ~20 min)
- search.google.com/search-console → add `episodekit.vercel.app` → Sitemaps →
  `sitemap.xml` (FAQ + product markup will light up in Google).
- Directory kit: **`docs/directory-submissions.md`** (8 directories, ~3 min
  each with the prepared copy).

**Optional:** buy `episodekit.app` (~$10–20/yr) and point it at the Vercel
project — better branding, and email addresses finally become real.

---

## 6. Relaunch (new web app): unlock accounts + database (WP-02 blocker)

The rebuilt app (`web/`, preview project **episodekit-web**) deploys and renders keyless,
but sign-up and saving need three things only you can create. Until then the preview shows
the shells with a "Sign in isn't set up in this preview." card.

1. **Clerk** — Vercel Marketplace → Clerk (or dashboard.clerk.com): create an app,
   enable Email link + Google. Copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (pk_…)
   - `CLERK_SECRET_KEY` (sk_…)
2. **Neon Postgres** — Vercel Marketplace → Neon: create the database, copy
   - `DATABASE_URL` (postgres://…)
3. **Clerk webhook** — Clerk dashboard → Webhooks → Add endpoint:
   `https://<your-preview-domain>/api/webhooks/clerk`, subscribe to
   `user.created`, `user.updated`, `user.deleted`; copy the signing secret (whsec_…) as
   - `CLERK_WEBHOOK_SIGNING_SECRET`

Then: Vercel → episodekit-web → Settings → Environment Variables (all four above) →
redeploy, and run the migration once:
`cd web && pnpm exec drizzle-kit migrate` (uses `DATABASE_URL`; the SQL lives in
`web/db/migrations/`).

Result: sign-up lands on onboarding step 1, a workspace(plan=free) row is created by the
webhook, and RSS prefill works against real feeds. Env var reference: `web/.env.example`.

---
That's the whole list. Every morning at 9 the agent session checks uptime,
executes the day's roadmap items (A1–A7), activates whatever you've unlocked,
and logs everything to the [live map](https://episodekit.vercel.app/map).

---

## 7. Lemon Squeezy (WP-08 blocker): subscriptions + quota walls activate

The billing code (checkout, webhook, cancel, quota) is built and tested with
signed fixtures, but nothing charges until you create the LS store. Until then:
upgrade buttons answer "Checkout isn't set up in this preview." and every
workspace stays on Free. Three steps:

1. **LS store (test mode first)** — lemonsqueezy.com → create store
   **EpisodeKit**, then two products:
   - **EpisodeKit Pro** — $19/month subscription → note the **variant id**
   - **EpisodeKit Founding Pro** — $99/year subscription (first 100) → note the
     **variant id**
2. **Webhook** — Settings → Webhooks → new endpoint
   `https://<your-preview-domain>/api/webhooks/lemonsqueezy`, events: order +
   subscription lifecycle; copy the **signing secret**.
3. **Env vars** (Vercel → episodekit-web → Settings → Environment Variables):
   `LS_API_KEY`, `LS_STORE_ID`, `LS_WEBHOOK_SECRET`,
   `LS_VARIANT_PRO_MONTHLY`, `LS_VARIANT_FOUNDING` (numeric ids as strings) →
   redeploy. Verify with LS's "Send test" webhook + a test purchase.

Founding without a store (launch fallback, §0.2): create the $99/yr product's
**payment link**, set `LS_FOUNDING_PAYMENT_URL`, and flip buyers to Pro in
`/admin` (manual flag) — see the PR for WP-08 for the exact flow.
