// SermonKit ASR — provider-agnostic audio transcription (server-side).
// Providers (selected via env): deepgram | groq. Keys: ASR_API_KEY or
// <PROVIDER>_API_KEY. Returns plain transcript text. No key → throws AsrError
// "not_configured" so the caller can 503 and the client falls back to
// transcript-paste. Exported pure-ish for unit tests (fetch injectable).

export class AsrError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const MAX_BYTES = 4.4 * 1024 * 1024; // Vercel function body limit is 4.5MB

export function providerFor(env = process.env) {
  const explicit = (env.ASR_PROVIDER || "").toLowerCase();
  if (explicit) return explicit;
  if (env.DEEPGRAM_API_KEY) return "deepgram";
  if (env.GROQ_API_KEY) return "groq";
  return null;
}

export function keyFor(provider, env = process.env) {
  return env.ASR_API_KEY || (provider === "deepgram" ? env.DEEPGRAM_API_KEY : env.GROQ_API_KEY) || null;
}

// Read the entire raw request body into a Buffer (works for binary POSTs on
// Vercel Node functions where req.body is not pre-parsed).
export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BYTES) {
        reject(new AsrError("too_large", 413));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function transcribeDeepgram(audio, mimetype, key, fetchImpl) {
  const url =
    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en";
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": mimetype || "audio/webm" },
    body: audio,
  });
  if (!res.ok) throw new AsrError("deepgram_" + res.status, 502);
  const j = await res.json();
  const t = j?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  if (!t || !t.trim()) throw new AsrError("empty_transcript", 422);
  return t.trim();
}

async function transcribeGroq(audio, filename, mimetype, key, fetchImpl) {
  const form = new FormData();
  form.append("file", new Blob([audio], { type: mimetype || "audio/webm" }), filename || "audio.webm");
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "json");
  const res = await fetchImpl("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new AsrError("groq_" + res.status, 502);
  const j = await res.json();
  if (!j?.text || !j.text.trim()) throw new AsrError("empty_transcript", 422);
  return j.text.trim();
}

export async function transcribe(audio, { mimetype, filename, env, fetchImpl = fetch }) {
  if (!audio || !audio.length) throw new AsrError("empty_audio", 400);
  if (audio.length > MAX_BYTES) throw new AsrError("too_large", 413);
  const provider = providerFor(env);
  if (!provider || provider === "none") throw new AsrError("not_configured", 503);
  const key = keyFor(provider, env);
  if (!key) throw new AsrError("not_configured", 503);
  if (provider === "deepgram") return transcribeDeepgram(audio, mimetype, key, fetchImpl);
  if (provider === "groq") return transcribeGroq(audio, filename, mimetype, key, fetchImpl);
  throw new AsrError("unknown_provider", 400);
}
