import { afterEach, describe, expect, it, vi } from "vitest";
import { AsrError, GROQ_MODEL, transcribeWithGroq } from "@/lib/asr/groq";

const CHUNKS = [
  { blobPath: "episodes/e1/chunk-0.webm", offsetMs: 0 },
  { blobPath: "episodes/e1/chunk-1.webm", offsetMs: 598_000 },
];

function groqResponse(segments: { start: number; end: number; text: string }[], language = "english") {
  return {
    text: segments.map((s) => s.text).join(" "),
    language,
    duration: segments.at(-1)?.end ?? 0,
    segments,
  };
}

/** Fetch mock: map URL → JSON body; tracks in-flight count for concurrency. */
function mockFetch(responses: Record<string, unknown>, opts: { status?: number; trackConcurrency?: boolean } = {}) {
  let inFlight = 0;
  let maxInFlight = 0;
  const calls: { url: string; form: FormData }[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const form = init?.body as FormData;
    calls.push({ url: String(input), form });
    if (opts.trackConcurrency) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
    }
    const filename = (form.get("file") as File | null)?.name ?? "";
    const key = Object.keys(responses).find((k) => filename.includes(k));
    const body = key ? responses[key] : Object.values(responses)[0];
    return new Response(JSON.stringify(body), {
      status: opts.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  return { fetchImpl, calls, maxInFlight: () => maxInFlight };
}

const fetchChunk = async (blobPath: string) => ({
  body: new ArrayBuffer(8),
  contentType: "audio/webm",
  filename: blobPath.split("/").pop() ?? "chunk.webm",
});

afterEach(() => {
  delete process.env.ASR_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.ASR_PROVIDER;
});

describe("transcribeWithGroq", () => {
  it("posts verbose_json with segment granularity, language=en and the model", async () => {
    const { fetchImpl, calls } = mockFetch({ "audio/transcriptions": groqResponse([{ start: 0, end: 2, text: "Hello." }]) });
    const segments = await transcribeWithGroq([CHUNKS[0]], { vocab: [] }, { fetchImpl, fetchChunk, apiKey: "k" });
    expect(segments).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    const form = calls[0].form;
    expect(form.get("model")).toBe(GROQ_MODEL);
    expect(GROQ_MODEL).toBe("whisper-large-v3-turbo");
    expect(form.get("response_format")).toBe("verbose_json");
    expect(form.get("timestamp_granularities[]")).toBe("segment");
    expect(form.get("language")).toBe("en");
    const file = form.get("file");
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe("chunk-0.webm");
  });

  it("builds the prompt from vocabulary (≤200 tokens ≈ 800 chars)", async () => {
    const { fetchImpl, calls } = mockFetch({ "audio/transcriptions": groqResponse([{ start: 0, end: 1, text: "Hi." }]) });
    const vocab = Array.from({ length: 400 }, (_, i) => `term${i}-with-a-long-name`);
    await transcribeWithGroq([CHUNKS[0]], { vocab }, { fetchImpl, fetchChunk, apiKey: "k" });
    const prompt = String(calls[0].form.get("prompt"));
    expect(prompt.startsWith("term0-with-a-long-name")).toBe(true);
    expect(prompt.length).toBeLessThanOrEqual(800);
  });

  it("merges chunk results in order with offsets (concurrency 3)", async () => {
    const { fetchImpl, maxInFlight } = mockFetch(
      {
        "chunk-0": groqResponse([{ start: 0, end: 4, text: "First." }]),
        "chunk-1": groqResponse([{ start: 2.5, end: 6, text: "Second." }]),
        "c2": groqResponse([{ start: 1, end: 5, text: "Third." }]),
        "c3": groqResponse([{ start: 2, end: 4, text: "Fourth." }]),
      },
      { trackConcurrency: true },
    );
    const segments = await transcribeWithGroq(
      [CHUNKS[0], CHUNKS[1], { blobPath: "c2", offsetMs: 1_196_000 }, { blobPath: "c3", offsetMs: 1_794_000 }],
      { vocab: [] },
      { fetchImpl, fetchChunk, apiKey: "k" },
    );
    expect(maxInFlight()).toBeLessThanOrEqual(3);
    expect(segments.map((s) => s.text)).toEqual(["First.", "Second.", "Third.", "Fourth."]);
    expect(segments[1].startMs).toBe(600_500);
    expect(segments[3].startMs).toBe(1_796_000);
  });

  it("throws unsupported_language when the whisper language is not English", async () => {
    const { fetchImpl } = mockFetch({ "audio/transcriptions": groqResponse([{ start: 0, end: 1, text: "こんにちは" }], "japanese") });
    await expect(
      transcribeWithGroq(CHUNKS, { vocab: [] }, { fetchImpl, fetchChunk, apiKey: "k" }),
    ).rejects.toMatchObject({ code: "unsupported_language", status: 422 });
  });

  it("throws unsupported_language when the text fails the Latin ratio", async () => {
    const { fetchImpl } = mockFetch({ "audio/transcriptions": groqResponse([{ start: 0, end: 1, text: "Привет привет привет привет" }], "english") });
    await expect(
      transcribeWithGroq(CHUNKS, { vocab: [] }, { fetchImpl, fetchChunk, apiKey: "k" }),
    ).rejects.toMatchObject({ code: "unsupported_language" });
  });

  it("maps a Groq error response to AsrError groq_<status>", async () => {
    const { fetchImpl } = mockFetch({ "audio/transcriptions": { error: { message: "bad key" } } }, { status: 401 });
    await expect(
      transcribeWithGroq(CHUNKS, { vocab: [] }, { fetchImpl, fetchChunk, apiKey: "k" }),
    ).rejects.toMatchObject({ code: "groq_401", status: 502 });
  });

  it("throws empty_transcript when the chunk has no segments (no_speech)", async () => {
    const { fetchImpl } = mockFetch({ "audio/transcriptions": groqResponse([], "english") });
    await expect(
      transcribeWithGroq(CHUNKS, { vocab: [] }, { fetchImpl, fetchChunk, apiKey: "k" }),
    ).rejects.toMatchObject({ code: "empty_transcript", status: 422 });
  });

  it("throws not_configured without a key", async () => {
    await expect(
      transcribeWithGroq(CHUNKS, { vocab: [] }, { fetchImpl: mockFetch({}).fetchImpl, fetchChunk }),
    ).rejects.toBeInstanceOf(AsrError);
  });

  it("accepts ASR_API_KEY/GROQ_API_KEY from env when no apiKey option", async () => {
    process.env.GROQ_API_KEY = "env-key";
    const { fetchImpl, calls } = mockFetch({ "audio/transcriptions": groqResponse([{ start: 0, end: 1, text: "Hi." }]) });
    await transcribeWithGroq(CHUNKS, { vocab: [] }, { fetchImpl, fetchChunk });
    expect(calls[0].form).toBeInstanceOf(FormData); // request attempted with env key
  });
});
