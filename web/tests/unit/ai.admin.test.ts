// §7.5 admin AI routes at the documented interface: owner gate (OWNER_EMAILS +
// Clerk user), GET/PUT /api/admin/ai, POST /api/admin/ai/test, and U18 — a
// saved selection changes the next generation's provider/model.
import { afterEach, describe, expect, it } from "vitest";
import { requireOwner, type ClerkUserLike } from "@/lib/ai/owner";
import { adminAiGet, adminAiPut, adminAiTest } from "@/lib/ai/admin";
import { generateArtifact } from "@/lib/ai/generate";
import { DEFAULT_VOICE_PROFILE } from "@/lib/ai/voice";
import { DEFAULT_AI_SELECTION } from "@/lib/ai/settings";
import { chatJson, demoSegments, fakeProvider, scriptedFetch, noSleep } from "./helpers/ai";

afterEach(() => {
  delete (globalThis as Record<string, unknown>).__episodekitGlmWorking;
});

const envOf = (e: Record<string, string>) => e as NodeJS.ProcessEnv;

type Body = Record<string, unknown>;
function bodyOf(res: { body: unknown }): Body {
  return res.body as Body;
}

function memoryStore(initial: unknown = null) {
  const calls: Array<{ key: string; value: unknown }> = [];
  let v = initial;
  return {
    calls,
    get: async (key: string) => (key === "ai" ? v : null),
    put: async (key: string, value: unknown) => {
      calls.push({ key, value });
      if (key === "ai") v = value;
    },
  };
}

function owner(gate: Parameters<typeof requireOwner>[0]) {
  return () => requireOwner(gate);
}

const ownerOk = owner({
  ownerEmails: ["owner@show.fm"],
  currentUser: async () =>
    ({ id: "u_1", primaryEmailAddress: "owner@show.fm" }) as ClerkUserLike,
});

describe("requireOwner (owner-only boundary, M13)", () => {
  it("accepts a Clerk user whose primary email is in OWNER_EMAILS", async () => {
    const r = await requireOwner({
      ownerEmails: ["owner@show.fm"],
      currentUser: async () => ({ id: "u", primaryEmailAddress: "Owner@Show.fm" }) as ClerkUserLike,
    });
    expect(r.ok).toBe(true);
  });

  it("401 for anonymous, 403 for non-owner", async () => {
    const anon = await requireOwner({ ownerEmails: ["o@x"], currentUser: async () => null });
    expect(anon.ok).toBe(false);
    expect(anon.status).toBe(401);
    const stranger = await requireOwner({
      ownerEmails: ["o@x"],
      currentUser: async () => ({ id: "u", primaryEmailAddress: "other@x" }) as ClerkUserLike,
    });
    expect(stranger.ok).toBe(false);
    expect(stranger.status).toBe(403);
  });

  it("denies by default when OWNER_EMAILS is not configured (tie-break logged)", async () => {
    const r = await requireOwner({
      ownerEmails: [],
      currentUser: async () => ({ id: "u", primaryEmailAddress: "o@x" }) as ClerkUserLike,
    });
    expect(r.status).toBe(503);
    expect(r.reason).toBe("owner_not_configured");
  });

  it("denies when the auth layer is unavailable (no Clerk keys)", async () => {
    const r = await requireOwner({
      ownerEmails: ["o@x"],
      currentUser: async () => { throw new Error("Missing publishableKey"); },
    });
    expect(r.status).toBe(503);
    expect(r.reason).toBe("auth_unavailable");
  });
});

describe("GET /api/admin/ai", () => {
  it("returns the effective selection, its source, and per-provider key presence", async () => {
    const res = await adminAiGet({
      requireOwner: ownerOk,
      store: null,
      env: envOf({ GLM_API_KEY: "k" }),
    });
    expect(res.status).toBe(200);
    expect(bodyOf(res).source).toBe("default");
    expect(bodyOf(res).selection).toEqual(DEFAULT_AI_SELECTION);
    expect(bodyOf(res).storeAvailable).toBe(false);
    const providers = bodyOf(res).providers as Array<{ id: string; keyPresent: boolean }>;
    expect(providers.find((p) => p.id === "glm-coding")?.keyPresent).toBe(true);
    expect(providers.find((p) => p.id === "groq")?.keyPresent).toBe(false);
  });

  it("reads a configured store", async () => {
    const store = memoryStore({
      provider: "openai",
      longModel: "gpt-4o",
      fastModel: "gpt-4o-mini",
      fallbackProvider: "groq",
    });
    const res = await adminAiGet({ requireOwner: ownerOk, store, env: envOf({}) });
    expect(bodyOf(res).source).toBe("settings");
    const selection = bodyOf(res).selection as { provider: string };
    expect(selection.provider).toBe("openai");
  });

  it("the gate blocks before anything else", async () => {
    const res = await adminAiGet({
      requireOwner: owner({ ownerEmails: ["o@x"], currentUser: async () => null }),
      store: null,
      env: envOf({}),
    });
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/admin/ai (U18)", () => {
  const body = {
    provider: "groq",
    longModel: "openai/gpt-oss-120b",
    fastModel: "openai/gpt-oss-20b",
    fallbackProvider: "glm-coding",
  };

  it("persists a valid selection at the app_settings interface", async () => {
    const store = memoryStore();
    const res = await adminAiPut({ requireOwner: ownerOk, store, env: envOf({}) }, body);
    expect(res.status).toBe(200);
    expect(bodyOf(res).selection).toEqual(body);
    expect(store.calls).toEqual([{ key: "ai", value: body }]);
  });

  it("400 on invalid selections (unknown provider, empty model, bad fallback)", async () => {
    const store = memoryStore();
    for (const bad of [
      { ...body, provider: "skynet" },
      { ...body, longModel: "" },
      { ...body, fallbackProvider: "nope" },
      {},
      null,
    ]) {
      const res = await adminAiPut({ requireOwner: ownerOk, store, env: envOf({}) }, bad);
      expect(res.status).toBe(400);
    }
    expect(store.calls).toHaveLength(0);
  });

  it("400 when the custom provider has no base URL configured", async () => {
    const store = memoryStore();
    const res = await adminAiPut(
      { requireOwner: ownerOk, store, env: envOf({}) },
      { provider: "custom", longModel: "m", fastModel: "m", fallbackProvider: "groq" },
    );
    expect(res.status).toBe(400);
  });

  it("503 when no settings store is wired yet (documented WP-02 seam)", async () => {
    const res = await adminAiPut({ requireOwner: ownerOk, store: null, env: envOf({}) }, body);
    expect(res.status).toBe(503);
  });

  it("the next generation after PUT uses the saved provider and model", async () => {
    const store = memoryStore();
    await adminAiPut({ requireOwner: ownerOk, store, env: envOf({}) }, body);
    const fetchImpl = scriptedFetch([
      chatJson(
        JSON.stringify({
          oneLiner: "Focus is a trainable skill.",
          short: "The episode examines attention in ordinary weeks.",
          long: "The episode examines attention in ordinary weeks and offers one reset ritual.",
        }),
      ),
    ]);
    // generateArtifact with the same store → chain resolves to groq + saved model
    const res = await generateArtifact({
      kind: "summary",
      segments: demoSegments,
      show: { name: "S", defaultCta: "c", allowedUrls: [] },
      voice: DEFAULT_VOICE_PROFILE,
      deps: {
        store,
        env: envOf({ GROQ_API_KEY: "g" }),
        fetchImpl,
        sleep: noSleep,
      },
    });
    expect(res.status).toBe("ai");
    expect(res.provider).toBe("groq");
    const reqBody = JSON.parse(String(fetchImpl.calls[0].init.body));
    expect(reqBody.model).toBe("openai/gpt-oss-120b");
    expect(fetchImpl.calls[0].url).toBe("https://api.groq.com/openai/v1/chat/completions");
  });
});

describe("POST /api/admin/ai/test", () => {
  it("returns ok with latency and usage for a working provider", async () => {
    const chain = [fakeProvider("groq", [JSON.stringify({ ok: true })], { in: 10, out: 3 })];
    const res = await adminAiTest(
      { requireOwner: ownerOk, env: envOf({}), chainFor: () => chain },
      {},
    );
    expect(res.status).toBe(200);
    expect(bodyOf(res).ok).toBe(true);
    expect(bodyOf(res).provider).toBe("groq");
    expect(bodyOf(res).latencyMs).toBeGreaterThanOrEqual(0);
    expect(bodyOf(res).usage).toEqual({ in: 10, out: 3 });
  });

  it("returns ok:false with the error code when the provider fails", async () => {
    const chain = [fakeProvider("groq", [new Error("1113 no coding-plan resource")])];
    const res = await adminAiTest(
      {
        requireOwner: ownerOk,
        env: envOf({}),
        chainFor: (selection) => {
          chain[0] = fakeProvider(selection.provider, [new Error("1113 no coding-plan resource")]);
          return chain;
        },
      },
      { provider: "glm-coding" },
    );
    expect(res.status).toBe(200);
    expect(bodyOf(res).ok).toBe(false);
    expect(bodyOf(res).error).toBeTruthy();
    expect(bodyOf(res).provider).toBe("glm-coding");
  });

  it("400 on an unknown provider in the body", async () => {
    const res = await adminAiTest(
      { requireOwner: ownerOk, env: envOf({}), chainFor: () => [] },
      { provider: "skynet" },
    );
    expect(res.status).toBe(400);
  });
});
