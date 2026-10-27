# Architecture: data, contracts, AI and ASR, repo layout

> Part of the EpisodeKit MVP relaunch spec. Index: [README.md](README.md). Binding rules: [01-product.md §0](01-product.md).

## 7. Data & contracts

### 7.1 Schema (Drizzle, `web/db/schema.ts`)
```
users(id text pk = Clerk id, email, name, created_at)
workspaces(id uuid pk, owner_id, plan enum(free|pro) default free, plan_source enum(ls|manual|null),
           founding bool, ls_customer_id, ls_subscription_id, status enum(active|past_due|cancelled),
           current_period_end, created_at)
shows(id uuid, workspace_id unique, name, rss_url, artwork_url, listen_url, default_cta,
      vocabulary text[], voice_profile jsonb, voice_samples text[], created_at)
episodes(id uuid, show_id, title, number, guests jsonb, source enum(upload|paste|sample),
         audio_blob_path, duration_ms, has_timestamps bool, has_speakers bool,
         status enum(uploading|queued|transcribing|writing|ready|failed), error_code,
         quota_month char(7), counts_quota bool, created_at, updated_at)
segments(id text 'seg_000123', episode_id, idx, speaker text null, start_ms int null, end_ms int null, text)
analysis(episode_id pk, chapters jsonb, topics text[], candidate_quotes jsonb /*QuoteRef[]*/)
artifacts(id uuid, episode_id, kind enum(show_notes|chapters|summary|titles|blog|newsletter|social|quotes),
          status enum(pending|writing|ready|failed|fallback), content jsonb, previous_content jsonb null,
          ready_flag bool, regen_count int, provider text, model text, error_code, updated_at,
          unique(episode_id, kind))
feedback(id, user_id, episode_id null, artifact_kind null, rating smallint null, note text, created_at)
usage_events(id, workspace_id, episode_id, kind enum(asr|llm|free_tool), provider, model, units, cost_usd, created_at)
app_settings(key text pk, value jsonb)   -- ai provider selection (no secrets)
webhook_events(id text pk, provider, processed_at)
```

### 7.2 Artifact content shapes (Zod, `web/lib/artifacts/schemas.ts`)
`QuoteRef {segmentId, start, end}` (char offsets in segment text; `endSegmentId?` for spans ≤3 segments).
- show_notes `{hook, bullets[4..7], guestLine?, quoteRefs[0..1], cta}` (chapters rendered from chapters artifact)
- chapters `{items:[{startMs, title≤50}] 5..12}`
- summary `{oneLiner≤140, short, long}`
- titles `{items:[{text≤80, style, starred}] x8}`
- blog `{seoTitle≤60, metaDescription≤155, slug, bodyMarkdown, quoteRefs[2]}` — body contains `{{quote:1}}` placeholders rendered from refs
- newsletter `{subjects[3], chosen, previewText≤90, bodyMarkdown, quoteRefs[1], ctaText≤30}`
- social `{linkedin≤1300, thread[4..6 ≤280], instagram{caption≤2200, hashtags[5..10]}}`
- quotes `{items:[QuoteRef] x5}`

### 7.3 Quote-by-reference (`web/lib/quotes/`)
1. Model sees numbered transcript lines `[seg_000123|Maya|01:12] text`.
2. Model returns `{segmentId, exact}`; server normalizes (port `normalizeQuoteStyle` from `engine/glm.js`, `normalizeWs` from `engine/lib.js`) and finds `exact` in the segment (or segment+next 2).
3. Found → store offsets against original text. Not found → drop; fill from `analysis.candidate_quotes` (deterministic `rankedSentences()` from `engine/lib.js`).
4. UI always renders source text by offsets; model text is never displayed as a quote.
5. Trim to 40–240 chars at word/sentence boundaries.
Tests: port all quote tests from `engine/test.js` + a property test (1,000 mutated quotes: curly, truncated, paraphrased → no non-substring ever emitted).

### 7.4 Voice profile
`{tone[3], formality 1-5, energy 1-5, humor 1-5, person I|we|they, sentenceLength short|medium|long, emoji none|light|heavy, signaturePhrases[≤5], neverSay[≤30], alwaysInclude[≤5], ctaStyle≤120}`.
Default: `{tone:[clear,warm,curious], formality:3, energy:3, humor:2, person:we, sentenceLength:medium, emoji:none, signaturePhrases:[], neverSay:[delve, game-changer, unlock, dive deep, in today's fast-paced world], alwaysInclude:[], ctaStyle:"Invite listeners to follow the show."}`

### 7.5 API routes (Next.js route handlers; Clerk auth unless marked public)
| Route | Purpose |
|---|---|
| POST `/api/uploads/token` | Blob client-upload token (type allow-list, ≤300 MB compressed, quota check) |
| POST `/api/episodes` | create `{source, blobPaths[]?, transcriptText?, title?, number?, guests?}` → `{id}`; counts quota |
| POST `/api/episodes/:id/transcribe` | runs Groq on chunks → segments; status transcribing→queued-for-writing (maxDuration 300) |
| POST `/api/episodes/:id/analyze` | chapters/topics/candidate quotes (fast model) |
| POST `/api/episodes/:id/artifacts/:kind/generate` | one artifact (long/fast model), `{instruction?}` for regenerate |
| GET `/api/episodes/:id` | episode + artifacts (quotes resolved) + status — polled every 2 s while not terminal |
| PATCH `/api/episodes/:id` · DELETE | edit meta / delete (+ blob) |
| PATCH `/api/artifacts/:id` | `{content}` save · `{ready}` · `{undo:true}` |
| GET `/api/audio/:episodeId` | short-lived signed URL for playback |
| POST/PATCH `/api/show` | show settings · POST `/api/show/voice/learn` · POST `/api/show/voice/preview` |
| POST `/api/rss/preview` | SSRF-safe feed fetch (block private IPs, 5 MB cap, 5 s timeout) |
| POST `/api/feedback` | rating/note |
| POST `/api/billing/checkout` · POST `/api/billing/cancel` | LS |
| POST `/api/webhooks/lemonsqueezy` (public) | HMAC verify (port `api/ls-webhook.js`), idempotent |
| POST `/api/webhooks/clerk` (public) | user upsert/delete |
| POST `/api/public/tools/:tool` (public) | free tools; BotID + rate limit + cost cap |
| GET/PUT `/api/admin/ai` · POST `/api/admin/ai/test` | owner only |
Orchestration: the workspace page (client) drives `transcribe → analyze → generate×7 (parallel, max 4 concurrent)` and persists nothing client-side; each server step is idempotent and checks status, so a refresh or second tab resumes from DB state ("resume" button if a step was interrupted >2 min). Ready email sent by the last finishing generate step.

---

## 8. AI & ASR layers

### 8.1 Provider registry (`web/lib/ai/`) — switchable, OpenAI-compatible first
All providers implement one interface:
```ts
interface LlmProvider { id: string; complete(req: { system: string; user: string; model: string;
  json: boolean; temperature?: number; maxTokens?: number; signal?: AbortSignal }): Promise<{ text: string; usage?: {in:number; out:number} }> }
```
Built-in adapters (one generic OpenAI-compatible adapter + config presets):
| Preset id | Base URL | Default long / fast model | Key env |
|---|---|---|---|
| `glm-coding` (**default**) | `https://api.z.ai/api/coding/paas/v4` | `glm-4.6` / `glm-4.5-air` | `GLM_API_KEY` |
| `glm-open` | `https://open.bigmodel.cn/api/paas/v4` | `glm-4.6` / `glm-4-flash` | `GLM_API_KEY` |
| `groq` (**fallback**) | `https://api.groq.com/openai/v1` | chosen at build from Groq's current model list (record in DECISIONS.md) | `GROQ_API_KEY` |
| `openai` | `https://api.openai.com/v1` | set via env | `OPENAI_API_KEY` |
| `openrouter` | `https://openrouter.ai/api/v1` | set via env | `OPENROUTER_API_KEY` |
| `anthropic` | native Messages API adapter | set via env | `ANTHROPIC_API_KEY` |
| `custom` | `AI_CUSTOM_BASE_URL` | `AI_CUSTOM_MODEL_LONG/FAST` | `AI_CUSTOM_API_KEY` |

Selection order: `app_settings.ai` (set in `/admin`: provider, longModel, fastModel, fallbackProvider) → env `AI_PROVIDER`, `AI_MODEL_LONG`, `AI_MODEL_FAST`, `AI_FALLBACK_PROVIDER` → defaults above. **Keys only ever live in env vars**; admin shows "key present ✓/✗". Port the multi-endpoint retry + working-endpoint cache from `engine/glm.js` into the glm presets.
Call policy: primary (timeout 60 s, 1 retry on 429/5xx with 2 s backoff) → fallback provider → deterministic builder (`lib/engine`, TS port of `engine/lib.js`) with status `fallback`.
JSON: request `response_format: json_object` when supported; always validate with Zod; on failure one "repair" call ("Return valid JSON for this schema: …"); then fallback.
Log every call to `usage_events` (tokens, est. cost from a per-model price table in `lib/ai/prices.ts`, 0 if unknown).
**Owner action**: GLM error 1113 means the Z.ai account has no coding-plan resource package — buy/activate it, or the app runs on the Groq fallback automatically.

### 8.2 Prompts (`web/lib/prompts/{analyze,show-notes,chapters,summary,titles,blog,newsletter,social,quotes,voice-learn,voice-preview,shorten}.ts`, `PROMPT_VERSION` const)
Shared system prompt:
```
You write podcast content for the show "{show}". Match the show's voice: tone {tone};
formality {formality}/5; energy {energy}/5; humor {humor}/5; write as "{person}"; {sentenceLength}
sentences; emoji: {emoji}. You may use these phrases sparingly: {signaturePhrases}.
Never use: {neverSay}. Include where natural: {alwaysInclude}.
Use only facts from the transcript. Never invent names, numbers, links or claims.
To quote, return {"segmentId": "...", "exact": "..."} with text copied character-for-character
from that segment. Anything not copied exactly is discarded.
Return only JSON matching the schema below.
```
User prompt = per-artifact rules (counts/limits from §7.2) + JSON schema + metadata (title, guests, CTA) + ≤2 voice samples (≤400 words each, "style reference only") + numbered transcript. Budget: if transcript > ~60k tokens, keep first 40% + last 20% + top-ranked segments; record `truncated`.
Weak-model hardening (GLM/Groq): low temperature (0.4 long, 0.2 analyze), schemas kept flat, one artifact per call, examples of the JSON shape inline.

### 8.3 ASR (`web/lib/asr/`)
Interface `transcribe(chunks: {blobPath, offsetMs}[], opts: {vocab: string[]}) → Segment[]`. Groq adapter: `POST /openai/v1/audio/transcriptions`, model `whisper-large-v3-turbo`, `response_format=verbose_json`, `timestamp_granularities[]=segment`, `language=en`, `prompt` = vocabulary + guest names (≤200 tokens). Port error handling from `api/asr.js`.
Chunking is done **in the browser** during compression: produce ≤10-min Opus chunks (~1.8 MB each), upload all, pass offsets. Server transcribes chunks with concurrency 3 and merges, de-duplicating the 2 s overlap by timestamp. Merge Whisper segments into ~sentence-group segments (≤45 s / ≤500 chars). Language check: Whisper `language` field ≠ english or Latin ratio <0.6 (port `supportedInput()` from `api/generate-suite.js`) → fail `unsupported_language`, refund.
Deepgram adapter = growth phase only (§0.3).

### 8.4 Post-checks (every AI artifact)
Limits/counts (trim at sentence boundary; regenerate once if badly off) · `neverSay` word-boundary scan → one regenerate with feedback → else replace phrase · strip URLs not in show settings · religion-neutral gate on generated framing (term list from `engine/test.js`), never on transcript quotes.

---

## 9. Repo layout
```
project-okra/
  legacy/        # current site/ api/ engine/ moved here at cutover (WP-10); untouched before
  web/           # NEW Next.js app → Vercel project root at cutover
    app/(marketing) app/(app)/app app/admin app/api
    components/ui components/app
    db/ lib/{ai,prompts,quotes,artifacts,asr,engine,billing,export,format}
    tests/unit tests/e2e evals/
  docs/relaunch/ # this spec split per section, mockups/, DECISIONS.md, BACKLOG.md, HANDOFF-PROMPT.md
  AGENTS.md      # points every agent to docs/relaunch/
```
Env: `DATABASE_URL`, `CLERK_*`, `BLOB_READ_WRITE_TOKEN`, `GLM_API_KEY`, `GROQ_API_KEY`, `AI_PROVIDER`, `AI_MODEL_LONG`, `AI_MODEL_FAST`, `AI_FALLBACK_PROVIDER`, optional `OPENAI_/OPENROUTER_/ANTHROPIC_/AI_CUSTOM_*`, `LS_API_KEY`, `LS_STORE_ID`, `LS_WEBHOOK_SECRET`, `LS_VARIANT_PRO_MONTHLY`, `LS_VARIANT_FOUNDING`, `RESEND_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `FREE_TOOL_DAILY_USD`, `OWNER_EMAILS`.
Security: auth + ownership check helper `requireEpisode(userId, id)` on every app route; private Blob via signed URLs; SSRF guard; rate limits (regenerate 60/h/user, free tools 5/day/IP); no secrets client-side.
