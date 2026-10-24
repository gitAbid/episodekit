// Tests for api/asr.js — provider selection, both provider shapes, error paths.
import { transcribe, providerFor, keyFor, AsrError } from "./asr.js";

let passed = 0, failed = 0;
const ok = (c, n) => { if (c) { passed++; console.log("  ✓", n); } else { failed++; console.error("  ✗ FAIL:", n); } };

console.log("provider selection");
ok(providerFor({}) === null, "no env → null");
ok(providerFor({ ASR_PROVIDER: "deepgram" }) === "deepgram", "explicit ASR_PROVIDER wins");
ok(providerFor({ DEEPGRAM_API_KEY: "x" }) === "deepgram", "deepgram key autodetects");
ok(providerFor({ GROQ_API_KEY: "x" }) === "groq", "groq key autodetects");
ok(keyFor("deepgram", { ASR_API_KEY: "shared" }) === "shared", "ASR_API_KEY shared override");
ok(keyFor("groq", { GROQ_API_KEY: "g" }) === "g", "per-provider key");

console.log("transcribe paths");
const audio = Buffer.alloc(1000);
try { await transcribe(audio, { env: {} }); ok(false, "no key throws"); }
catch (e) { ok(e instanceof AsrError && e.status === 503 && e.code === "not_configured", "no key → 503 not_configured"); }
try { await transcribe(Buffer.alloc(0), { env: { ASR_API_KEY: "k", ASR_PROVIDER: "groq" } }); ok(false, "empty audio throws"); }
catch (e) { ok(e.status === 400, "empty audio → 400"); }
try { await transcribe(Buffer.alloc(5 * 1024 * 1024), { env: { ASR_API_KEY: "k", ASR_PROVIDER: "groq" } }); ok(false, "oversize throws"); }
catch (e) { ok(e.status === 413, "oversize → 413"); }

const fakeFetch = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });
let captured = null;
const deepgramFetch = async (url, opts) => { captured = { url, opts }; return { ok: true, json: async () => ({ results: { channels: [{ alternatives: [{ transcript: "Grace and peace to you church." }] }] } }) }; };
const t1 = await transcribe(audio, { env: { ASR_PROVIDER: "deepgram", ASR_API_KEY: "dk" }, fetchImpl: deepgramFetch });
ok(t1 === "Grace and peace to you church.", "deepgram transcript extracted");
ok(captured.url.includes("deepgram") && captured.opts.headers.Authorization === "Token dk", "deepgram request shape");

const groqFetch = async (url, opts) => {
  captured = { url, opts, body: opts.body };
  ok(opts.body instanceof FormData, "groq gets FormData body");
  return { ok: true, json: async () => ({ text: "This is the sermon text." }) };
};
const t2 = await transcribe(audio, { env: { ASR_PROVIDER: "groq", GROQ_API_KEY: "gk" }, fetchImpl: groqFetch });
ok(t2 === "This is the sermon text.", "groq transcript extracted");
ok(captured.opts.headers.Authorization === "Bearer gk", "groq auth header");

try { await transcribe(audio, { env: { ASR_PROVIDER: "deepgram", ASR_API_KEY: "k" }, fetchImpl: fakeFetch(401, {}) }); ok(false, "upstream 401 throws"); }
catch (e) { ok(e.code === "deepgram_401" && e.status === 502, "deepgram 401 → 502 deepgram_401"); }
try { await transcribe(audio, { env: { ASR_PROVIDER: "groq", GROQ_API_KEY: "k" }, fetchImpl: fakeFetch(200, { text: "   " }) }); ok(false, "empty transcript throws"); }
catch (e) { ok(e.code === "empty_transcript" && e.status === 422, "empty transcript → 422"); }
try { await transcribe(audio, { env: { ASR_PROVIDER: "whisperapi", ASR_API_KEY: "k" } }); ok(false, "unknown provider throws"); }
catch (e) { ok(e.code === "unknown_provider", "unknown provider → 400"); }

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
