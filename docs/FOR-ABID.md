# FOR ABID — Your 5 actions (everything else is automated)

The machine is built, tested (62/62), live, and self-monitoring. Five things
only you can do — each unlocks a specific capability the same morning:

## 1. Lemon Squeezy (~15 min) → payments live
Follow **`docs/ls-activation-runbook.md`** top to bottom (exact clicks, prices,
webhook URL, env vars). Result: checkout buttons render on the site, buyers
get license keys automatically, the $49 founding offer goes live.
*Skip-test: after setup, the runbook's step 7 verifies end-to-end in 2 min.*

## 2. API keys (2 min) → AI + audio live
Vercel dashboard → project **episodekit** → Settings → Environment Variables:
- `GLM_API_KEY` (bigmodel.cn) → AI-enhanced artifacts activate
- `ASR_API_KEY` + `ASR_PROVIDER` (`deepgram` or `groq`) → audio upload activates
Then Deployments → ⋯ → Redeploy. The app flips itself to audio-first
automatically (config-driven — no code change). **Verify both unlocks in one
command:** `node scripts/verify-unlocks.mjs`.

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
That's the whole list. Every morning at 9 the agent session checks uptime,
executes the day's roadmap items (A1–A7), activates whatever you've unlocked,
and logs everything to the [live map](https://episodekit.vercel.app/map).
