# Decisions log

Agents append one entry per tie-break decision (01-product.md §0.4). Newest first.
Format: `YYYY-MM-DD · WP-XX · decision · why · alternatives considered`.

- 2026-10-27 · spec · Groq Whisper for MVP transcription; Deepgram deferred · speaker labels are not needed for the first paying clients, and Groq is ~6× cheaper and already configured · Deepgram nova-3 now
- 2026-10-27 · spec · GLM Coding Plan is the default LLM, Groq the fallback, behind a provider registry · owner preference; keeps provider switchable by env/admin · AI Gateway only
- 2026-10-27 · spec · Client-orchestrated pipeline instead of a durable workflow engine · fewer moving parts for the MVP; each step is idempotent and resumable from DB state · Vercel Workflow
