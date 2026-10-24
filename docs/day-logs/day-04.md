# Day 4 — 2026-10-24

**Build commit:** `00b6447` · app v0 (the paid-product core).

## What shipped
1. **ASR module** (`api/asr.js`) — provider-agnostic transcription: Deepgram
   (nova-2, smart_format) or Groq (whisper-large-v3-turbo) via `ASR_PROVIDER` /
   key autodetect (`ASR_API_KEY` / `DEEPGRAM_API_KEY` / `GROQ_API_KEY`); raw-body
   reader with 4.4MB guard; typed `AsrError` codes.
2. **Transcription endpoint** (`api/transcribe.js`) — POST raw audio bytes →
   `{transcript}`; coded errors: 503 `not_configured` (client falls back to
   transcript-paste), 413 `too_large`, 422 `empty_transcript`, 502 provider.
3. **The App** (`site/app.html`, `noindex`) — the core paid flow:
   - 🎙 Upload audio tab: file → browser-side decode → 16 kHz mono resample
     (OfflineAudioContext) → low-bitrate Opus/AAC re-encode (MediaRecorder,
     ~16 kbps) so a 45-min sermon fits Vercel's 4.5MB function body limit; live
     progress; clear 4.4MB-overage message steering to paste.
   - 📋 Paste transcript tab.
   - Result page via shared renderer (`site/js/suite-render.js`): all 6 artifacts,
     per-artifact Copy buttons, Download Markdown + Download JSON, "New sermon".
   - Free-tier counter (localStorage `sk_used_YYYY-MM`, 3/month) + upgrade card —
     honestly labeled beta; client-side only until payments land (Day 8).
4. **Local dev server** (`scripts/dev-server.mjs`) — serves `site/` + wires
   `/api/*` to the Vercel function modules so the full stack runs locally.
5. Landing CTAs now point at the app ("Open the app" / "Generate my content
   package").

## Verification (evidence)
- `npm test`: **22/22 engine + 17/17 ASR** (provider selection, both provider
  request/response shapes with injected fetch, 503/400/413/422/502 paths).
- `api/transcribe` handler (mock stream): 503 no-key, 413 oversize, 405 GET.
- Client JS syntax: `node --check` on suite-render.js + app inline script.
- **Browser e2e** (in-app browser against local dev server): opened app →
  switched to paste tab → filled 744-word sermon → clicked generate → result
  step rendered: title "Father — House", **6 artifact cards, 6 copy buttons**;
  quota decremented 3 → 2 (localStorage `sk_used_2026-10=1`).
- **Visual QA** on the result-page screenshot: verdict **SHIP** — layout
  aligned, no overflow/overlap/clipping, credible paid-product look; cosmetic
  nits only (metadata line contrast, subtitle orphan word).

## Not verified yet (honest)
- Full audio→ASR e2e requires an `ASR_API_KEY` in the environment (server 503
  path IS tested and the UI shows a clear paste-fallback message). The browser
  re-encode pipeline (decode→resample→MediaRecorder) is code-reviewed but not
  driven with real audio — do this the moment a key exists (Day 5+).
- Copy/download buttons verified by code + visual presence, not clicked in e2e.

## Not done / next (Day 5 start here)
- **Vercel deploy** (`vercel --prod` or repo connect), set env vars, verify
  live URL; submit sitemap in Google Search Console; Lighthouse ≥90 landing.

## Blockers
None for deploy. ASR/LLM keys still unset — product works keyless (deterministic
engine + paste flow); audio path activates the moment keys exist.
