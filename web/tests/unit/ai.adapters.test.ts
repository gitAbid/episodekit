// Adapter behaviour: OpenAI-compatible generic adapter (timeout, 1 retry on
// 429/5xx with backoff, usage mapping, json mode), anthropic Messages adapter,
// GLM multi-endpoint retry + working-endpoint cache (ported from engine/glm.js).
import { afterEach, describe, expect, it } from "vitest";
import { createOpenAiCompatProvider } from "@/lib/ai/openai-compat";
import { createAnthropicProvider } from "@/lib/ai/anthropic";
import { createGlmProvider, resetGlmWorkingCache } from "@/lib/ai/glm";
import { ProviderError } from "@/lib/ai/types";
import { chatJson, noSleep, scriptedFetch, TOKENS } from "./helpers/ai";

afterEach(() => resetGlmWorkingCache());

const ok = () => scriptedFetch([chatJson("{\"ok\":true}", TOKENS)]);

describe("OpenAI-compatible adapter", () => {
  const base = { id: "test", baseUrl: "https://api.example/v1", apiKey: () => "k", sleep: noSleep };

  it("posts system/user messages with json mode and maps usage", async () => {
    const fetchImpl = ok();
    const p = createOpenAiCompatProvider({ ...base, fetchImpl });
    const res = await p.complete({ system: "sys", user: "usr", model: "m1", json: true });
    expect(res.text).toBe("{\"ok\":true}");
    expect(res.usage).toEqual({ in: 100, out: 50 });
    const body = JSON.parse(String(fetchImpl.calls[0].init.body));
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "usr" },
    ]);
    expect(body.model).toBe("m1");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect((fetchImpl.calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer k");
  });

  it("omits response_format when json mode is unsupported", async () => {
    const f = scriptedFetch([chatJson("plain text")]);
    const p = createOpenAiCompatProvider({ ...base, fetchImpl: f, jsonMode: false });
    await p.complete({ system: "s", user: "u", model: "m", json: true });
    expect(JSON.parse(String(f.calls[0].init.body)).response_format).toBeUndefined();
  });

  it("throws no_key before any request when the key is missing", async () => {
    const fetchImpl = ok();
    const p = createOpenAiCompatProvider({ ...base, apiKey: () => undefined, fetchImpl });
    await expect(p.complete({ system: "s", user: "u", model: "m", json: true })).rejects.toMatchObject({
      code: "no_key",
    });
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("retries once on 429 with backoff, then succeeds", async () => {
    const sleeps: number[] = [];
    const fetchImpl = scriptedFetch([429, chatJson("{\"ok\":true}")]);
    const p = createOpenAiCompatProvider({ ...base, fetchImpl, sleep: async (ms) => { sleeps.push(ms); } });
    const res = await p.complete({ system: "s", user: "u", model: "m", json: true });
    expect(res.text).toBe("{\"ok\":true}");
    expect(fetchImpl.calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
  });

  it("retries once on 5xx and surfaces server_error when the retry fails too", async () => {
    const fetchImpl = scriptedFetch([500, 503]);
    const p = createOpenAiCompatProvider({ ...base, fetchImpl, sleep: noSleep });
    await expect(p.complete({ system: "s", user: "u", model: "m", json: true })).rejects.toMatchObject({
      code: "server_error",
      status: 503,
    });
    expect(fetchImpl.calls).toHaveLength(2);
  });

  it("does not retry 4xx (bad_request) and never on 401/403", async () => {
    const fetchImpl = scriptedFetch([401]);
    const p = createOpenAiCompatProvider({ ...base, fetchImpl, sleep: noSleep });
    await expect(p.complete({ system: "s", user: "u", model: "m", json: true })).rejects.toMatchObject({
      code: "bad_request",
    });
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it("aborts with timeout when the endpoint hangs past the deadline", async () => {
    // fetch that never resolves until aborted
    const slow = ((url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      })) as typeof fetch;
    const p = createOpenAiCompatProvider({ ...base, fetchImpl: slow, timeoutMs: 20, sleep: noSleep });
    await expect(p.complete({ system: "s", user: "u", model: "m", json: true })).rejects.toMatchObject({
      code: "timeout",
    });
  });

  it("reports empty when the response has no content", async () => {
    const fetchImpl = scriptedFetch([{ choices: [{ message: {} }] }]);
    const p = createOpenAiCompatProvider({ ...base, fetchImpl, sleep: noSleep });
    await expect(p.complete({ system: "s", user: "u", model: "m", json: true })).rejects.toMatchObject({
      code: "empty",
    });
  });
});

describe("Anthropic Messages adapter", () => {
  it("posts the native Messages shape with system on top and maps usage", async () => {
    const fetchImpl = scriptedFetch([
      {
        content: [{ type: "text", text: "{\"ok\":true}" }],
        usage: { input_tokens: 12, output_tokens: 5 },
      },
    ]);
    const p = createAnthropicProvider({ apiKey: () => "k", fetchImpl, sleep: noSleep });
    const res = await p.complete({ system: "sys", user: "usr", model: "claude-x", json: true });
    expect(res.text).toBe("{\"ok\":true}");
    expect(res.usage).toEqual({ in: 12, out: 5 });
    expect(fetchImpl.calls[0].url).toBe("https://api.anthropic.com/v1/messages");
    const headers = fetchImpl.calls[0].init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("k");
    expect(headers["anthropic-version"]).toBeTruthy();
    const body = JSON.parse(String(fetchImpl.calls[0].init.body));
    expect(body.system).toBe("sys");
    expect(body.messages).toEqual([{ role: "user", content: "usr" }]);
    expect(body.model).toBe("claude-x");
    expect(body.response_format).toBeUndefined();
  });

  it("retries 429/5xx once like the OpenAI-compatible adapter", async () => {
    const fetchImpl = scriptedFetch([429, { content: [{ type: "text", text: "hi" }], usage: { input_tokens: 1, output_tokens: 1 } }]);
    const p = createAnthropicProvider({ apiKey: () => "k", fetchImpl, sleep: noSleep });
    const res = await p.complete({ system: "s", user: "u", model: "m", json: false });
    expect(res.text).toBe("hi");
    expect(fetchImpl.calls).toHaveLength(2);
  });
});

describe("GLM multi-endpoint retry + working-endpoint cache (port of engine/glm.js)", () => {
  it("tries the next endpoint flavor when one fails and caches the winner", async () => {
    // coding endpoint 401s for both models (no plan resource, error 1113),
    // plain z.ai paas endpoint works
    const fetchImpl = scriptedFetch([401, 401, chatJson("{\"ok\":true}")]);
    const p = createGlmProvider({
      presetId: "glm-coding",
      model: "glm-4.6",
      apiKey: () => "k",
      fetchImpl,
      sleep: noSleep,
    });
    const res = await p.complete({ system: "s", user: "u", model: "glm-4.6", json: true });
    expect(res.text).toBe("{\"ok\":true}");
    expect(fetchImpl.calls.length).toBeGreaterThanOrEqual(2);
    expect(fetchImpl.calls[0].url).toContain("/api/coding/paas/v4");
    const urls = fetchImpl.calls.map((c) => c.url);
    expect(urls.some((u) => u.includes("/api/paas/v4")) || urls.some((u) => u.includes("bigmodel"))).toBe(true);
  });

  it("second call goes to the cached working endpoint first", async () => {
    const fetchImpl = scriptedFetch([401, chatJson("{\"ok\":true}"), chatJson("{\"ok\":2}")]);
    const p = createGlmProvider({
      presetId: "glm-coding",
      model: "glm-4.6",
      apiKey: () => "k",
      fetchImpl,
      sleep: noSleep,
    });
    await p.complete({ system: "s", user: "u", model: "glm-4.6", json: true });
    await p.complete({ system: "s", user: "u", model: "glm-4.6", json: true });
    // first call: [0]=coding fail, [1]=winner; second call must start at the winner
    expect(fetchImpl.calls[2].url).toBe(fetchImpl.calls[1].url);
  });

  it("glm-open endpoints stay on bigmodel.cn", async () => {
    const fetchImpl = scriptedFetch([chatJson("{\"ok\":true}")]);
    const p = createGlmProvider({
      presetId: "glm-open",
      model: "glm-4-flash",
      apiKey: () => "k",
      fetchImpl,
      sleep: noSleep,
    });
    await p.complete({ system: "s", user: "u", model: "glm-4-flash", json: true });
    for (const c of fetchImpl.calls) expect(c.url).toContain("open.bigmodel.cn");
  });

  it("throws all_endpoints_failed when every flavor fails", async () => {
    const fetchImpl = scriptedFetch([401, 401, 401, 401]);
    const p = createGlmProvider({
      presetId: "glm-coding",
      model: "glm-4.6",
      apiKey: () => "k",
      fetchImpl,
      sleep: noSleep,
    });
    await expect(p.complete({ system: "s", user: "u", model: "glm-4.6", json: true })).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});
