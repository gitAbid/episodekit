# Day 9 (build session 9) — 2026-10-25

**Build commit:** (see follow-up docs commit) · demo video #1.

## What shipped
**38-second narrated product demo**, embedded on the landing page and ready for
the Product Hunt gallery: [live](https://episodekit.vercel.app/) (video under
"How it works"), file `site/demo.mp4` (1280×720 h264+aac, 7.7MB, faststart).

How it was made (the interesting part):
- The in-app browser's video recorder proved unusable — free-run recordings die
  in <1s across kernel calls (guest restarts), and scripted mode hung on a
  waitFor. Pivoted to a **deterministic frame-sequenced demo**:
- 8 full-bleed frames captured from the LIVE app (920px viewport so the UI
  fills the frame; quota key reset in the browser profile so generation runs):
  landing → paste tab filled → result header → summary → article → discussion
  kit → email series → social pack.
- Title + end cards rendered by `scripts/gen_cards.swift` (CoreGraphics, brand
  gold/dark, matching the OG image).
- Narration: 31.5s cloud TTS (`out/narration.mp3`) from a 104-word script.
- Composition (`out/build-demo.sh`, ffmpeg): Ken Burns zoompan alternating
  in/out per segment, 0.5s crossfades, 2s title card, 3.5s end card, narration
  delayed to the body, audio fade-out. Bugs fixed en route: 645s duration
  (zoompan × looped input blowup → single stills), missing drawtext filter in
  this ffmpeg build (→ Swift-rendered cards), 8px white edge strip from the
  viewport capture (→ crop 912:720 before zoompan; verified: both edge lumas
  now 30/30).

## Verification (evidence)
- `npm test` 60/60.
- ffprobe: 37.83s, h264 1280×720 + aac, 7.69MB.
- Visual QA passes: title card (wordmark/tagline centered, crisp), mid-flow
  frame (app ~90% width after the full-bleed recapture, text sharp), end card
  (CTA + URL clean) — SHIP after the pillarbox + edge-strip fixes; edge-luma
  check confirms the strip is gone.
- Live: demo.mp4 200, **range request → 206** (streams properly), landing
  embed present.

## Not done / next (session 10 start here)
- PH launch prep pack: gallery ordering, maker first-comment draft, "how it's
  built" story (the honesty validator is the hook).
- Show HN draft text (free tool is instantly usable — meets the try-it bar).

## Blockers
None new. User-side: LS account, API keys, directory/GSC accounts.
