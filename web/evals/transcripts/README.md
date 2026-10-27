# Eval transcripts (WP-10)

Fixture transcripts for the eval gate. `demo.txt` is the real sample
(docs/samples/demo-episode.txt). The other seven are SYNTHETIC fixtures
written for this repo (plain invented speech, no real persons or shows) so
the gate can run before the owner records/collects CC0 episodes; replace
them 1:1 with real recordings by dropping files with the same shape
(speakers/timestamps where noted) and re-running `pnpm eval`.
