# Day 26 (build session 26) — 2026-10-26

**Build commit:** `a60e2d0` · real-ASR input quality fix.

## What shipped
1. **Speaker-label handling** — real ASR transcripts ("Host:", "Speaker 1:")
   previously polluted themes (a live test produced title "Speaker —
   Calendar"). Now: labels are stripped in normalization
   (`stripSpeakerLabels`) and label vocabulary is stopworded; quotes remain
   verbatim relative to the spoken content. New engine tests cover the
   labeled-transcript shape. Live-verified: same labeled input now yields
   "Calendar — Focus" with clean themes.
2. **Flaky test fixed** — `tampered key rejected` replaced the key's last hex
   char with "0", which sometimes *was* the char → intermittent failure.
   Now tampering guarantees a different char; suite run 3× → 65/65 every time
   (29 engine + 17 ASR + 19 license).
3. **Tool-page sync** — discussion-guide offline bank now matches the engine's
   6 follow-ups.

## Verification (evidence)
- `npm test` × 3 consecutive runs: all suites green each time.
- Live: labeled transcript → "Calendar — Focus", themes
  calendar/focus/expensive/resource.
- Unlock check (start of session): payments/audio still disabled.

## Next
Sprint calendar (A2 Tue). Machine on 9am/9pm cadence with unlock detection.

## Blockers
User-side only (docs/FOR-ABID.md).
