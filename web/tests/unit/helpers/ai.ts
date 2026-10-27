// Shared fixtures for the lib/ai test suite: segments, fake providers and a
// scripted fetch for adapter tests.
import { vi } from "vitest";
import { normalizeWs, sentences, stripSpeakerLabels } from "@/lib/engine";
import type { LlmProvider, CompleteRequest, CompleteResult, TokenUsage } from "@/lib/ai/types";
import type { Segment } from "@/lib/quotes/types";
import { readFileSync } from "node:fs";

export const demoEpisode = readFileSync(
  new URL("../../fixtures/demo-episode.txt", import.meta.url),
  "utf8",
);

export function makeSegments(text: string, perSegment = 2): Segment[] {
  const sents = sentences(normalizeWs(stripSpeakerLabels(text)));
  const segments: Segment[] = [];
  for (let i = 0; i < sents.length; i += perSegment) {
    const idx = segments.length;
    segments.push({
      id: `seg_${String(idx).padStart(6, "0")}`,
      idx,
      speaker: idx % 2 === 0 ? "Maya" : null,
      startMs: idx * 60_000,
      endMs: (idx + 1) * 60_000,
      text: sents.slice(i, i + perSegment).join(" "),
    });
  }
  return segments;
}

export const demoSegments = makeSegments(normalizeWs(demoEpisode.split("\n---")[0]));

/** A provider whose complete() is a vi.fn() returning canned results in order. */
export function fakeProvider(
  id: string,
  results: Array<string | Error>,
  usage?: TokenUsage,
): LlmProvider & { calls: CompleteRequest[] } {
  const calls: CompleteRequest[] = [];
  let i = 0;
  return {
    id,
    calls,
    complete: vi.fn(async (req: CompleteRequest): Promise<CompleteResult> => {
      calls.push(req);
      const r = results[Math.min(i, results.length - 1)];
      i++;
      if (r instanceof Error) throw r;
      return { text: r, usage };
    }),
  };
}

/** A provider that always fails with the given error. */
export function failingProvider(id: string, message = "boom"): LlmProvider {
  return { id, complete: vi.fn(async () => { throw new Error(message); }) };
}

/** OpenAI-compatible JSON payload for a successful chat completion. */
export function chatJson(text: string, usage?: TokenUsage) {
  return {
    choices: [{ message: { content: text } }],
    ...(usage ? { usage: { prompt_tokens: usage.in, completion_tokens: usage.out } } : {}),
  };
}

export type FetchCall = { url: string; init: RequestInit };

/**
 * Scripted fetch: entries are checked in order; each entry is either a status
 * number (response with that status, body "{\"error\":\"x\"}") or a parsed
 * JSON body for a 200 response.
 */
export function scriptedFetch(
  entries: Array<number | Record<string, unknown>>,
): typeof fetch & { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  let i = 0;
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const e = entries[Math.min(i, entries.length - 1)];
    i++;
    if (typeof e === "number") {
      return new Response(JSON.stringify({ error: { message: "x" } }), { status: e });
    }
    return new Response(JSON.stringify(e), { status: 200 });
  }) as typeof fetch;
  return Object.assign(fn, { calls }) as typeof fetch & { calls: FetchCall[] };
}

export const noSleep = () => Promise.resolve();

export const TOKENS = { in: 100, out: 50 };
