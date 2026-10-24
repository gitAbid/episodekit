# Launch Pack — EpisodeKit (ready to paste)

Status: DRAFTS COMPLETE — waiting on launch-day user accounts. Recommended
order: Show HN first (test the pitch cold, free tool link, no signup wall),
then Product Hunt Tue–Thu the following week once any HN feedback is folded in.

---

## 1. Product Hunt submission

**Name:** EpisodeKit
**Tagline (≤60 chars):** One episode → a month of content. Quotes verbatim.
(alt: Turn a podcast episode into show notes, emails & social — instantly.)
**Website:** https://episodekit.vercel.app
**Pricing note:** Freemium

**Description (PH, ≤260 chars):**
Paste an episode, get the whole package: article-style show notes, a community
discussion kit, a 5-day email series, social captions with pull quotes, and
titles. Every quote is verbatim from your episode — nothing invented.

**First paragraph (full description):**
EpisodeKit turns one podcast episode into the content package that normally
eats your Sunday evening: an article-ready writeup with section headings, a
discussion kit for your community, a 5-day email series for your list, a social
pack with pull quotes, a summary, and title ideas. Upload audio or paste a
transcript. Free while in beta (3 episodes/month); Pro is $19/mo.

**Gallery order:**
1. `site/demo.mp4` — the 38s narrated demo (lead asset)
2. `docs/launch-assets/ph-landing-hero.png` — hero + CTA (1270×760, PH spec)
3. `docs/launch-assets/ph-app-result.png` — real result page (1270×760)
4. `docs/launch-assets/ph-samples.png` — full sample package (1270×760)
5. `docs/launch-assets/brand-1200x630.png` — brand card

(PH gallery images must be exactly 1270×760 — all pre-cropped in
`docs/launch-assets/`; the vertical cut for Shorts is `site/demo-vertical.mp4`.)

**Topics:** Podcasting · Artificial Intelligence · Productivity

**Maker first comment (post immediately after launch):**
> Hey all — I'm the maker. EpisodeKit started from a complaint I kept seeing:
> AI show-notes tools produce "quotes" the guest never said, and hosts end up
> rewriting everything anyway. So I built the engine the other way around:
> every quote in every artifact must be an exact substring of your transcript,
> verified at generation time — if the AI paraphrases, the artifact falls back
> to a deterministic build. Nothing invented, ever.
>
> There's a keyless deterministic engine underneath, so the whole thing works
> even with zero API keys configured — and the free single-artifact tools need
> no signup at all: show notes, titles, discussion kit, email series.
>
> Free while in beta: 3 episodes/month. Founding members get Pro for life at
> $49 (first 50). Happy to answer anything about the quote-integrity checks or
> the audio pipeline (browser-side compression to fit serverless limits was
> fun). What would make this part of your weekly workflow?

**Launch-day checklist:**
- [ ] Post Tue–Thu, 12:01am PT
- [ ] Maker comment within 2 minutes (draft above)
- [ ] Answer EVERY comment for 48h (set notifications)
- [ ] Do not ask anyone for upvotes (PH rule)
- [ ] Add the PH badge to the landing footer after launch

---

## 2. Show HN

**Title (≤80 chars):** Show HN: EpisodeKit – content package from one episode, quotes verbatim only

**URL to submit:** https://episodekit.vercel.app/tools/show-notes
(free tool, instantly usable, no signup — meets Show HN's "remove barriers"
rule; the landing/app are one click away)

**First comment (post right after submitting):**
> The hook is the integrity check: any quote the AI returns is validated as an
> exact substring of your transcript, and if it fails, that artifact silently
> falls back to a deterministic extractive build — so the output can't invent
> things your guests never said.
>
> How it works, honestly:
> - A keyless deterministic engine (theme extraction, ranked sentence
>   selection, verbatim-quote anchoring) produces the full package: article /
>   show notes, discussion kit, 5-day email series, social pack, summary,
>   titles. This is what runs when no API keys are configured.
> - With a GLM key, an LLM pass rewrites prose (titles, reflections, captions),
>   but every quote/anchor still passes the substring validator or gets
>   rejected per-artifact.
> - Audio path: the browser re-encodes to 16 kHz mono Opus before upload so a
>   45-min episode fits a serverless request body; server-side ASR is
>   provider-pluggable (Deepgram/Groq).
>
> The link goes to the free show-notes tool — no signup, paste a transcript and
> it works. The full app (all six artifacts, audio upload) is at /app. Free
> while in beta; I'm building in the open — sprint map, decisions and all, at
> /map. Feedback welcome, especially on what artifacts would actually make
> this part of your workflow.

**Show HN rules honored:** try-it-now link, maker-disclosed, no vote asks,
one submission only (no repost if it flops).

---

## 3. Launch-week promo blurb (Reddit-legal value-first replies, IH post, X/LinkedIn build-in-public)

Short: "I built a free show-notes generator that only quotes your episode
verbatim — the validator rejects anything the AI paraphrases. No signup:
[link]. I'm the maker; feedback welcome."

## 4. Dependencies (user accounts) — from ROADMAP
- Product Hunt account (maker badge), Show HN account (with some karma ideally)
- Lemon Squeezy (activates checkout at launch — founding $49 LTD is the
  launch-week offer)
- Directory + GSC accounts (pre-launch backlinks)
