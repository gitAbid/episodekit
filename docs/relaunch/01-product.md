# Product: context, decisions, users, MVP features, stories

> Part of the EpisodeKit MVP relaunch spec. Index: [README.md](README.md). Binding rules: [01-product.md §0](01-product.md).

## 0. Context & decisions

### 0.1 Why
Current EpisodeKit (`site/`, `api/`, `engine/`, 46 sessions) has 0 real users. Production output
comes from the extractive fallback (`engine/lib.js`) because GLM is blocked (error 1113), so the
sample yields titles like "Attention — Version". There are no accounts, no saved episodes and no
voice, so there's no reason to come back weekly. The MVP fixes exactly those three things.

### 0.2 Locked decisions (owner, 2026-10-27)
| Area | MVP decision | Later (growth, §12) |
|---|---|---|
| Market | Podcasters, English only | + coaches/webinars if pulled |
| Positioning | **"Show notes that sound like you — and never misquote you."** | |
| App | Next.js App Router + TypeScript, Vercel, Node runtime | |
| DB | Neon Postgres (Vercel Marketplace) + Drizzle ORM | |
| Auth | Clerk (Marketplace): email link + Google | teams/seats |
| Files | Vercel Blob (private), client-direct upload of **browser-compressed** audio | larger raw files |
| Jobs | Client-orchestrated steps + DB status (no queue infra) | Vercel Workflow |
| ASR | **Groq Whisper** (`whisper-large-v3-turbo`) — key already configured | Deepgram for diarization (§0.3) |
| LLM | **Provider registry, default = GLM Coding Plan**; switch by env/admin: provider, base URL, key, models (§8.1) | |
| Fallback LLM | Groq (OpenAI-compatible) using the existing Groq key | |
| Billing | Lemon Squeezy (MoR). If store not live at launch: LS payment link for "Founding Pro" + manual plan flag | full subscriptions |
| Email | Resend (only "package ready" + magic link via Clerk) | lifecycle emails |
| Analytics | PostHog free + in-app feedback (👍/👎 + note per artifact) | |
| UI | Tailwind v4 + shadcn/ui + lucide; tokens §5 | Tiptap rich editor |
| Design reference | HTML mockups in `docs/relaunch/mockups/` (§5.6, built first) + optional Claude Design screens | |

### 0.3 Do we need Deepgram? — **No, not for the MVP.**
| Need | Groq Whisper | Deepgram nova-3 |
|---|---|---|
| Accurate English text | ✅ | ✅ |
| Timestamps for chapters + "Verified · 23:41" | ✅ segment-level (`verbose_json`) | ✅ word-level |
| Cost per hour | ~$0.04 | ~$0.26+ |
| Speaker labels (who said it) | ❌ | ✅ diarization |
| Custom vocabulary | partial (`prompt`, ~224 tokens) | ✅ keyterm |
| File limit | 25 MB/request (free) → we compress + chunk | 2 GB via URL |

Business goal = first paying clients. Show notes, chapters, summary, titles, blog, newsletter
and social posts do **not** need speaker labels. Quotes show "— from the episode" unless the user
pasted a speaker-labelled transcript (Riverside/Descript/Otter exports, which most interview
hosts already have). **Add Deepgram only when** ≥30% of beta feedback asks for speaker names,
or the Guest kit (§12) is greenlit. The ASR layer is an interface so this is a one-file add.

### 0.4 Tie-break rules
1. Boring, documented library defaults. 2. Fewer screens/settings/clicks. 3. Not in §3 → `BACKLOG.md`, don't build.
4. Copy from §6; otherwise plain, second person, ≤12 words, no hype words. 5. Only §5 tokens/components.
6. Verify library APIs against **installed** docs (node_modules or context7), not memory.

### 0.5 Hard rules (permanent, from ROADMAP.md)
No fake metrics/testimonials/logos. Every claim true of shipped code. **Quotes are reconstructed
from the transcript, never from model text** (§7.3). Keep the religion-neutral test gate.
No spam; maker-disclosed sharing. One-click cancel. API keys never reach the browser.

---

## 1. Problems → MVP answers
| # | Podcaster problem | MVP answer |
|---|---|---|
| P1 | 2–3 h per episode writing show notes | Upload → 7 artifacts in < 5 min (60-min ep) |
| P2 | "AI output is generic, I rewrite it" | Show Voice learned from 1–3 past show notes, used in every prompt |
| P3 | "It misquoted my guest" | Quote-by-reference: quotes come from transcript text only; badge + play-from-timestamp |
| P4 | Tools are expensive/overwhelming | One screen per episode, 7 artifacts, $19 flat |
| P5 | Chapters are tedious | Auto chapters from timestamps, editable, platform formats |
| P6 | Every platform wants different formatting | Copy presets: Apple, Spotify, YouTube, Markdown, plain |
| P7 | Cancelling is a nightmare elsewhere | Cancel in 2 clicks |

## 2. Personas
- **Maya (primary)** — indie weekly interview host, does post-production Sunday nights, $10–30/mo tool budget, has a Riverside transcript.
- **Dev** — solo expert show, wants LinkedIn + blog in his own voice.
- (Growth) **Priya** — producer of 3 shows; **Guest** — share-page recipient.

---

## 3. MVP feature set (build only this)

**M1 Sign-in & show setup** — Clerk sign-in; onboarding: (1) show name + optional RSS URL (prefill artwork/description), (2) voice samples (paste 1–3 past show notes ≥150 words, or "Skip"), (3) first episode.

**M2 New episode** — two sources:
- *Upload audio/video* (mp3, m4a, wav, aac, ogg, webm, mp4, mov; ≤ **2 h** for MVP). Browser compresses to mono 16 kHz Opus/WebM 24 kbps (port `site/app.html` compression logic) → ~11 MB/h → Blob upload with progress.
- *Paste transcript* — plain text, SRT, VTT, Riverside/Descript/Otter `Name (00:12:03): text`, `[00:12:03] Name: text`. Detected format chip; timestamps + speakers kept when present.
- Optional fields: episode title, episode #, guest name(s).
- "Try with a sample episode" (`docs/samples/demo-episode.txt`) — free, no quota.

**M3 Transcription (Groq)** — server fetches blob, splits into ≤20 MB chunks (by duration, ~10-min chunks with 2 s overlap if file >20 MB, via `ffmpeg`-free approach: client already produced chunks — see §8.3), calls Groq `audio/transcriptions` with `response_format=verbose_json`, `timestamp_granularities[]=segment`, `language=en`, `prompt=` show vocabulary + guest names. Segments stored with start/end ms. Non-English / empty → clear error, no quota used.

**M4 Package (7 artifacts)** generated in parallel:
1. **Show notes** — hook (2–3 sentences), "In this episode" bullets (4–7), chapters, guest line (if guest), CTA from show settings.
2. **Chapters** — 5–12, first at 00:00, ≥2 min apart, title ≤50 chars (only when timestamps exist).
3. **Summary** — one-liner ≤140 chars, short 50–80 words, long 150–220 words.
4. **Titles** — 8, each tagged style (Curiosity, Benefit, Guest, Number, Question, Quote); star favourites.
5. **Blog post** — 900–1300 words, H2s, SEO title ≤60, meta ≤155, slug, 2 verified quotes.
6. **Newsletter** — 3 subject options, preview text ≤90, body 250–400 words, 1 verified quote, CTA text.
7. **Social posts** — LinkedIn ≤1300 chars; X/Threads thread 4–6 posts ≤280; Instagram caption ≤2200 + 5–10 hashtags.
+ **Quotes** — 5 verified pull quotes (40–240 chars), shown in their own panel and reused above.

**M5 Verbatim badges** — each quote shows `Verified · mm:ss` (timestamps) or `Verified in transcript`; click → popover with surrounding sentence and ▶ play from that time (audio from Blob signed URL). Quotes are read-only blocks; user can Remove or Swap (pick another candidate). No in-place quote editing in MVP.

**M6 Edit** — every text field is an auto-growing textarea (Markdown allowed for show notes/blog/newsletter bodies, rendered preview toggle). Autosave 1.5 s. Char/word counters with limits. **Regenerate** per artifact with optional instruction (≤200 chars, presets: Shorter · Punchier · More casual · More formal). Cap 20 regenerations/episode. Previous content kept as one "Undo regenerate" snapshot (no version history in MVP).

**M7 Copy & export** — per artifact: Copy (plain) + destination menu: Apple Podcasts (plain ≤4000, chapters appended), Spotify (plain ≤4000), YouTube description (chapters with `0:00`), Markdown, Plain text. "Download all (.md)" single file. Free plan appends footer line `Show notes made with EpisodeKit`.

**M8 Library** — episodes list for the show: title, status, length, date, "Ready x/7" (user ticks Ready per artifact).

**M9 Show settings** — General (name, artwork URL, listen link, default CTA, vocabulary terms) and Voice (§7.4 profile as chips + sliders, samples list, "Update preview").

**M10 Plans** — Free: 2 episodes/month, ≤60 min, footer. **Pro $19/mo** (or **Founding Pro $99/yr, first 100**): 10 episodes/month, ≤2 h, no footer. Quota counted when generation starts; refunded on pipeline failure. Over quota → wall with Upgrade.

**M11 Feedback** — per artifact 👍/👎 + optional note (stored + PostHog). Floating "Feedback" button → textarea → stored + emailed to owner. This is how we learn what to grow.

**M12 Free tools (keep URLs)** — `/tools/show-notes`, `/tools/episode-titles`, `/tools/email-series`, `/tools/discussion-guide`, plus `/compare/*`, `/guides/*`, `/templates/show-notes`, `/samples` keep their paths and SEO copy; tools call the real LLM on pasted text ≤15k words with BotID + 5/day/IP + global daily cost cap (`FREE_TOOL_DAILY_USD`, default 3) → deterministic fallback with honest note.

**M13 Admin (owner only, `OWNER_EMAILS` env)** — `/admin`: signups, episodes processed, artifacts exported, feedback list, AI provider status + switcher (§8.1), cost last 7 days.

**Explicitly NOT in MVP** (→ §12): diarization, guest kit/share pages, quote card images, RSS episode import, version history, rewrite-selection, teams/multiple shows, ZIP export, chapters.json, search, integrations, Workflow durability, dark-mode toggle UI (auto dark via CSS only is fine).

---

## 4. User stories (MVP, all Must)
Format: story → acceptance (Given/When/Then).
- **U1** Sign up with Google/email link → land on onboarding step 1; DB has user + workspace(plan=free).
- **U2** Create show; valid RSS prefills name/artwork in <3 s; invalid → "We couldn't read that feed. Check the URL or skip."
- **U3** Paste past show notes, "Learn my voice" → profile chips/sliders in ≤15 s; Skip → default profile (§7.4).
- **U4** Upload a 60-min mp3 → compressed + uploaded with % progress; refreshing the page resumes showing server status.
- **U5** Paste a Riverside transcript → format chip "Riverside · speakers and timestamps found"; quotes later show speaker names + times.
- **U6** Full package for a 60-min episode ready in ≤5 min p90; artifacts appear one by one as they finish.
- **U7** Clicking a quote badge plays audio within 1 s of the quote start.
- **U8** No banned word from my profile appears in any artifact.
- **U9** If one artifact fails, others still show; failed card has "Try again" (no quota).
- **U10** If every AI provider fails, I get the basic package labelled with the fallback banner (§6).
- **U11** Edit any field; leave and return → edits are there.
- **U12** Regenerate blog post with "shorter" → new text; "Undo regenerate" restores previous.
- **U13** Copy show notes for Apple Podcasts → plain text ≤4000 chars with chapters; over limit → warning + "Shorten to fit" (AI).
- **U14** Free user on 3rd episode → quota wall; Upgrade → LS checkout → plan becomes Pro within 10 s of webhook (or manual flag for Founding link).
- **U15** Cancel from Settings → Billing in ≤2 clicks; see access end date.
- **U16** Visitor uses `/tools/show-notes` without signup → real AI output in <60 s; CTA to sign up.
- **U17** All old public URLs return 200 at the same path.
- **U18** Owner switches AI provider/model in `/admin` → next generation uses it; test button shows OK/error.
- **U19** Non-English audio → "EpisodeKit works with English episodes for now. This one wasn't charged."
