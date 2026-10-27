# Design: UX, tokens, components, mockups, copy

> Part of the EpisodeKit MVP relaunch spec. Index: [README.md](README.md). Binding rules: [01-product.md §0](01-product.md).

## 5. UI / UX design

### 5.1 Principles
One episode = one screen · Trust is visible (badges, honest fallbacks) · Flat & calm (borders, one accent, no gradients) · Ready checkboxes drive completion · WCAG 2.2 AA.

### 5.2 Tokens (exact; evolved from current `site/css/theme.css`)
Light: `--bg #ffffff` `--surface #ffffff` `--surface-2 #f6f7f9` `--surface-3 #eceef2` `--border #e3e6eb` `--border-strong #cdd2da` `--text #111827` `--body #4b5563` `--faint #6b7280` `--accent #2457d6` `--accent-hover #1d48b5` `--accent-soft #eef3ff` `--accent-border #c7d5f7` `--on-accent #ffffff` `--success #13795b/#e8f5ef` `--warning #9a5b00/#fdf3e2` `--danger #b42318/#fdecea`.
Dark (`prefers-color-scheme: dark`): `--bg #0e1116` `--surface #151a21` `--surface-2 #1b212a` `--surface-3 #232a35` `--border #2a313c` `--border-strong #3a4350` `--text #f3f4f6` `--body #c3c8d0` `--faint #8b93a0` `--accent #5b8cff` `--accent-hover #7aa2ff` `--accent-soft #1a2540` `--accent-border #2c3f6e` `--on-accent #0e1116` `--success #3fbf8f/#12291f` `--warning #e0a548/#2d2312` `--danger #ff6b5e/#2f1614`.
Type: Inter via `next/font`. display 40/48 (mobile 32/40) w650 · h1 28/36 w650 · h2 20/28 w600 · h3 16/24 w600 · body 15/24 · small 13/20 · micro 12/16 w500. Mono for timestamps.
Space 4-pt: 4 8 12 16 20 24 32 40 56 80. Radius 6/8/10/12/pill. No shadows except popover/menu/dialog `0 8px 24px rgb(17 24 39/.12)`. Focus ring 2px accent + 2px offset. Motion 120 ms hover, 150 ms popover fade. Breakpoints 640/768/1024/1280.

### 5.3 Components
shadcn: Button (primary, secondary=bordered, ghost, destructive; 32/40/48px), Input, Textarea, Select, Slider, Switch, Checkbox, Tabs (underline), Badge, Toast (bottom-right 4 s), Dialog, Sheet, Popover, DropdownMenu, Tooltip, Progress, Skeleton.
Custom: **StatusPill** (Queued faint · Transcribing/Writing accent+spinner · Ready success · Failed danger) · **VerifiedBadge** (success-soft, check icon, `Verified · 23:41`) · **QuoteBlock** (3px accent left border, quote text, `— Maya` or `— from the episode`, badge, Remove/Swap) · **ArtifactNavItem** (icon, name, ✓ if Ready) · **AudioMini** (play/pause, time, speed 1/1.5/2) · **DropZone** (dashed border-strong, 200px; drag-over accent-soft) · **QuotaMeter** · **CharCounter** (warning ≥90%, danger >100%) · **FeedbackThumbs**.

### 5.4 Routes
Public: `/` `/pricing` `/tools/*` `/compare/*` `/guides/*` `/templates/show-notes` `/samples` `/privacy` `/terms` · Auth: `/sign-in` `/sign-up` · App: `/app` (→ episodes), `/app/onboarding/[show|voice|first]`, `/app/episodes`, `/app/episodes/new`, `/app/episodes/[id]/[artifact?]`, `/app/settings/[show|voice|billing|account]` · Owner: `/admin`.

### 5.5 Mockups (reference — must be matched)

**MK-1 Landing `/`**
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ◼ EpisodeKit        Tools   Pricing   Samples              Sign in  [Start free]│
├───────────────────────────────────────────────────────────────────────────────┤
│  Show notes that sound like you —            ┌───────────────────────────────┐ │
│  and never misquote you.                     │ Ep 42 · Attention is a budget │ │
│                                              │ Show notes  Summary  Titles … │ │
│  Upload an episode. Get show notes, chapters,│ In this episode               │ │
│  a blog post, a newsletter and social posts  │ • Why focus is a budget       │ │
│  in minutes — in your voice, with every      │ ▌"We budget our dollars, we   │ │
│  quote checked against the audio.            │ ▌ calendar our hours…"        │ │
│                                              │   [✓ Verified · 01:12]        │ │
│  [Start free — 2 episodes/month]  See a real sample →                        │ │
│  No card required · Cancel anytime           └───────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────────────┤
│  3 hours every Sunday   │   Generic AI copy    │   Misquoted guests           │
│  …one line each         │   …                  │   …                          │
├───────────────────────────────────────────────────────────────────────────────┤
│  How it works:  ① Upload  →  ② Review in your voice  →  ③ Copy anywhere        │
│  What you get:  [Show notes][Chapters][Summary][Titles][Blog][Newsletter][Social]│
│  Quote check:   ✓ Kept "exact words" 23:41      ✕ Rejected "paraphrase"        │
│  Pricing:  [Free $0]  [Pro $19 ★]  Founding: $99/yr — 37 of 100 left           │
│  FAQ (6)                                         footer · A PeraByte AI product│
└───────────────────────────────────────────────────────────────────────────────┘
```
Mobile: hero stacks (text, buttons full-width, preview below), feature grid 2 columns, pricing cards stacked.

**MK-2 Onboarding (centred card 560px)**
```
        Step 2 of 3 ● ● ○
 ┌──────────────────────────────────────────────┐
 │ Teach EpisodeKit your voice                  │
 │ Paste 1–3 past show notes or newsletters.    │
 │ ┌──────────────────────────────────────────┐ │
 │ │ (textarea)                               │ │
 │ └──────────────────────────────────────────┘ │
 │ 212 words · at least 150      [+ add another]│
 │                                              │
 │ [Learn my voice]            Skip for now     │
 └──────────────────────────────────────────────┘
  → after learning: tone chips [clear ✕][warm ✕][curious ✕][+]
    Formality ──●──── Energy ───●── Humor ─●──── Emoji (None|Light|Heavy)
    Never say [delve ✕][game-changer ✕][+]        [Continue]
```

**MK-3 Episodes list `/app/episodes`**
```
┌ ◼ EpisodeKit   The Focus Hour ▾                         Feedback   (MA)▾ ┐
│ Episodes                          ▬▬▬▬▬▬▬░░ 3 of 10 · resets Nov 14  [+ New episode] │
│ ┌────────────────────────────────────────────────────────────────────┐   │
│ │ Title                          Status        Length  Ready  Date   │   │
│ │ Ep 42 · Attention is a budget  ● Ready       58:12   6/7    Oct 26 │   │
│ │ Ep 41 · Saying no              ◌ Writing…    44:03   —      Oct 19 │   │
│ └────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
Empty: "No episodes yet" / "Upload your first episode and get a full content package in minutes."
       [New episode]  Try a sample episode
```

**MK-4 New episode**
```
 New episode
 [ Upload audio ]  [ Paste transcript ]          ← underline tabs
 ┌ - - - - - - - - - - - - - - - - - - - - - - - - - - - - ┐
 |        ⤒  Drop audio or video, or browse               |
 |        MP3, M4A, WAV, MP4, MOV · up to 2 hours         |
 └ - - - - - - - - - - - - - - - - - - - - - - - - - - - - ┘
 After pick: ep42.mp3 · 58:12 · Compressing ▬▬▬▬░░ 64%  → Uploading ▬▬▬░ 40%
 Details  Episode title (optional) [__________]  Episode # [__]
          Guests [name ________] [+ add guest]
 [Create package]   Uses 1 of your 10 episodes this month.
```

**MK-5 Processing (same URL as workspace until ready)**
```
 Ep 42 · Untitled                                   ◌ Transcribing
  ✓ Uploaded · 58:12
  ● Transcribing — about a minute
  ○ Finding chapters and quotes
  ○ Writing your package
 [Show notes ░░░] [Chapters ░░░] [Summary ░░░] [Titles ░░░]
 [Blog post ░░░]  [Newsletter ░░] [Social ░░░]  [Quotes ░░░]   ← skeleton cards, clickable when ready
 You can leave this page — we'll email you when it's ready.
```

**MK-6 Episode workspace (core)**
```
┌ ← Episodes  Ep 42 · Attention is a budget ✎   ● Ready   6/7 ready      [Download all] ┐
├──────────────┬────────────────────────────────────────────────┬──────────────────────┤
│ Show notes ✓ │ Show notes                 ☐ Ready   👍 👎      │ Quotes               │
│ Chapters   ✓ │ [Regenerate ▾]  [Copy ▾ Apple Podcasts]  1,284/4000 │ ▌"We budget our…" │
│ Summary    ✓ │ ─────────────────────────────────────────────── │  — Maya  ✓ 01:12 ▶  │
│ Titles       │ Hook                                            │  [Swap] [Remove]     │
│ Blog post  ✓ │ ┌─────────────────────────────────────────────┐ │ ▌"A to-do item is…"  │
│ Newsletter ✓ │ │ Focus is the most expensive resource…       │ │  — Maya  ✓ 07:40 ▶  │
│ Social     ✓ │ └─────────────────────────────────────────────┘ │ …                    │
│              │ In this episode                                 │ ──────────────────── │
│ ──────────── │ • Why attention compounds         [✕]           │ Transcript (search)  │
│ Transcript   │ • Calendars beat to-do lists      [✕]  [+ bullet]│ 00:00 Today I want…  │
│ Settings     │ Chapters (from Chapters tab)                    │ 00:42 Here is the…   │
│ 220px        │ 00:00 Why focus is a budget                     │ 340px                │
└──────────────┴────────────────────────────────────────────────┴──────────────────────┘
```
- Regenerate ▾: presets Shorter · Punchier · More casual · More formal · Custom… ; after regenerate a toast "Regenerated · Undo".
- Copy ▾: Apple Podcasts · Spotify · YouTube · Markdown · Plain text (last used becomes the button label).
- Mobile <768: left nav → horizontal chip row under header; right panel → bottom tab [Write | Quotes | Transcript].
- Artifact layouts: **Titles** = 8 rows (style badge · text · ★ · copy · "Use as title"); **Summary** = 3 cards with own counters; **Blog** = SEO fields card above body textarea + preview toggle; **Newsletter** = subject radio ×3 + custom, preview text, body, CTA; **Social** = tabs LinkedIn | Thread | Instagram, thread posts as numbered cards each with counter; **Chapters** = rows `[mm:ss] [title] ✕` + "Add chapter".

**MK-7 Quote popover**
```
 ┌──────────────────────────────────────────────┐
 │ ✓ Verified · 01:12 — exact words from audio   │
 │ …and almost nobody manages it like money.     │
 │ **We budget our dollars, we calendar our      │
 │ hours, and then we let anyone with a          │
 │ notification spend our attention for free.**  │
 │ Here is the uncomfortable truth…              │
 │ [▶ Play from 01:12]                           │
 └──────────────────────────────────────────────┘
```

**MK-8 Settings → Voice** — left: chips + sliders + Never say / Always include + samples list; right: Preview card with 60-word sample and [Update preview].

**MK-9 Billing** — plan card (Free/Pro, renewal date, QuotaMeter), [Upgrade to Pro $19/mo] / [Founding Pro $99/yr · 37 left], [Manage payment] (LS portal), [Cancel plan] → dialog "Cancel Pro? You'll keep Pro until Nov 30. Your episodes stay." [Keep Pro] [Cancel plan].

**MK-10 Free tool page** — marketing nav · existing H1 · "Paste your transcript" textarea · [Generate] · read-only result card (same renderer) with Copy · CTA band "Get the full package from audio — free for 2 episodes/month" · existing guide copy.

**MK-11 Admin** — stat tiles (Signups 7d · Episodes 7d · Exports 7d · Paying · AI cost 7d) · AI provider card (provider select, base URL, long/fast model inputs, [Test] → "OK · 1.8 s" / error text, [Save]) · feedback table.

### 5.6 Mockup files (the visual reference — built)
Static HTML mockups using the §5.2 tokens and real demo content live in `docs/relaunch/mockups/`:
`01-landing`, `02-onboarding`, `03-episodes`, `04-new-episode`, `05-processing`, `06-workspace`,
`06b-artifact-layouts` (Titles, Summary, Blog, Newsletter, Social, Chapters), `07-quote-popover`
(badge popover, regenerate/copy menus, limit warning, fallback banner), `08-voice`, `09-billing`,
`10-free-tool`, `11-admin`. Shared styles: `mockups/mock.css` — port these tokens and component
styles directly into `web/app/globals.css` (WP-01).
Open `mockups/index.html` locally (gallery with desktop/mobile and light/dark toggles), or the owner's
private published copy: https://claude.ai/artifact/V2VxwixJ3XUuyixFYNE13p (shared only if the owner shares it).
Optionally mirror into Claude Design when the owner wants hi-fi edits; **this written spec wins on conflicts**.
Notes in amber boxes inside mockups are annotations, not UI.

### 5.7 States every screen implements
Loading = skeleton of final layout · Empty = icon + line + primary action · Error = inline message + retry (copy §6) · Offline banner "You're offline — changes will save when you reconnect." · Plan wall card. Accessibility: contrast AA, keyboard reachable, aria-live for status, labels on icon buttons, tap targets ≥40px, axe 0 violations.

---

## 6. Copy deck (verbatim)
Status: Uploading · Compressing · Queued · Transcribing · Writing · Ready · Failed.
Artifacts: Show notes · Chapters · Summary · Titles · Blog post · Newsletter · Social posts · Quotes.
Badges: `Verified · {mm:ss}` · `Verified in transcript`.
Fallback banner: "Basic version — our AI writer was unavailable. Regenerate when you're ready."
Errors: `unsupported_language` "EpisodeKit works with English episodes for now. This one wasn't charged." · `too_long` "Episodes can be up to {limit} on your plan." · `no_speech` "We couldn't hear any speech in this file. Check the audio and try again." · `transcribe_failed` / `generic` "Something went wrong on our side. Try again — it won't use another episode."
Quota wall: "You've used {used} of {limit} episodes this month. Upgrade for more, or wait until {resetDate}."
Toasts: Copied · Copied for {destination} · Saved · Regenerated · Undo.
Processing: "You can leave this page — we'll email you when it's ready."
Ready email: subject "Your package for “{title}” is ready" · body "Show notes, chapters, a blog post, a newsletter and social posts are ready to review." [Open episode].
