// M11 feedback pipeline: validation, storage port, PostHog capture port,
// Resend notify port (key present) + seam log (key absent).
import { describe, expect, it, vi } from "vitest";
import {
  handleFeedback,
  notifyOwnerByResend,
  ownerEmailRecipients,
  type FeedbackRow,
} from "@/lib/feedback/service";

const ROW: FeedbackRow = {
  userId: "user_1",
  episodeId: null,
  artifactKind: "titles",
  rating: -1,
  note: "Too long",
};

describe("handleFeedback", () => {
  const ports = () => ({
    insert: vi.fn(async () => {}),
    capture: vi.fn(async () => {}),
    notify: vi.fn(async () => {}),
    env: { NEXT_PUBLIC_POSTHOG_KEY: "phc_test" } as unknown as NodeJS.ProcessEnv,
  });

  it("401s without a user", async () => {
    const res = await handleFeedback(null, { rating: 1 }, ports());
    expect(res.status).toBe(401);
  });

  it("requires rating or note", async () => {
    const res = await handleFeedback("user_1", {}, ports());
    expect(res.status).toBe(400);
  });

  it("rejects unknown artifact kinds and over-long notes", async () => {
    const p = ports();
    expect((await handleFeedback("user_1", { rating: 1, artifactKind: "sermon" }, p)).status).toBe(400);
    expect((await handleFeedback("user_1", { note: "x".repeat(2001) }, p)).status).toBe(400);
  });

  it("stores, captures and notifies on success", async () => {
    const p = ports();
    const res = await handleFeedback("user_1", { rating: -1, note: "Too long", artifactKind: "titles" }, p);
    expect(res.status).toBe(200);
    expect(p.insert).toHaveBeenCalledWith(expect.objectContaining({ rating: -1, note: "Too long" }));
    expect(p.capture).toHaveBeenCalledWith(
      "feedback_submitted",
      expect.objectContaining({ rating: -1, artifact_kind: "titles", has_note: true }),
    );
    expect(p.notify).toHaveBeenCalled();
  });

  it("503s when there is no storage port", async () => {
    const res = await handleFeedback("user_1", { rating: 1 }, { capture: vi.fn() });
    expect(res.status).toBe(503);
  });

  it("skips capture silently when the PostHog key is absent", async () => {
    const p = ports();
    p.env = {} as unknown as NodeJS.ProcessEnv;
    const res = await handleFeedback("user_1", { rating: 1 }, p);
    expect(res.status).toBe(200);
    expect(p.capture).not.toHaveBeenCalled();
  });
});

describe("notifyOwnerByResend", () => {
  it("is a no-op without RESEND_API_KEY or OWNER_EMAILS", async () => {
    expect(await notifyOwnerByResend(ROW, { env: {} as unknown as NodeJS.ProcessEnv })).toBe(false);
    expect(
      await notifyOwnerByResend(ROW, { env: { RESEND_API_KEY: "re_x" } as unknown as NodeJS.ProcessEnv }),
    ).toBe(false);
  });

  it("posts to Resend when key + owner exist", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const ok = await notifyOwnerByResend(ROW, {
      env: {
        RESEND_API_KEY: "re_x",
        OWNER_EMAILS: "owner@example.com",
        FEEDBACK_FROM_EMAIL: "EpisodeKit <test@resend.dev>",
      } as unknown as NodeJS.ProcessEnv,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body)) as { to: string[]; from: string };
    expect(body.to).toEqual(["owner@example.com"]);
    expect(body.from).toContain("EpisodeKit");
  });

  it("parses OWNER_EMAILS lists", () => {
    expect(ownerEmailRecipients({ OWNER_EMAILS: "A@x.com, b@y.io c@z.net" } as unknown as NodeJS.ProcessEnv)).toEqual([
      "a@x.com",
      "b@y.io",
      "c@z.net",
    ]);
  });
});
