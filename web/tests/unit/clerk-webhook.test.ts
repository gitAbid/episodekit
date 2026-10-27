import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "svix";
import { handleClerkWebhook } from "@/lib/clerk-webhook/service";

vi.mock("@/db/queries", () => ({
  upsertUser: vi.fn(),
  getOrCreateWorkspaceByOwner: vi.fn(),
  deleteClerkUser: vi.fn(),
  isWebhookEventProcessed: vi.fn().mockResolvedValue(false),
  markWebhookEventProcessed: vi.fn(),
}));

import * as queries from "@/db/queries";
const mocked = vi.mocked(queries);

const SECRET = `whsec_${randomBytes(24).toString("base64")}`;

function signedRequest(eventType: string, data: unknown, opts: { secret?: string; id?: string } = {}) {
  const payload = JSON.stringify({ type: eventType, data, object: "event" });
  const timestamp = Math.floor(Date.now() / 1000);
  const id = opts.id ?? `msg_${randomBytes(8).toString("hex")}`;
  const signature = new Webhook(opts.secret ?? SECRET).sign(id, new Date(timestamp * 1000), payload);
  return new Request("http://localhost/api/webhooks/clerk", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(timestamp),
      "svix-signature": signature,
    },
    body: payload,
  });
}

const userCreated = {
  id: "user_2abc",
  object: "user",
  first_name: "Maya",
  last_name: "Lee",
  email_addresses: [
    { id: "e_1", email_address: "maya@focus.fm" },
    { id: "e_2", email_address: "other@focus.fm" },
  ],
  primary_email_address_id: "e_1",
};

beforeEach(() => {
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  vi.clearAllMocks();
});

describe("POST /api/webhooks/clerk", () => {
  it("returns 503 when no signing secret is configured", async () => {
    delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    const res = await handleClerkWebhook(signedRequest("user.created", userCreated));
    expect(res.status).toBe(503);
    expect(mocked.upsertUser).not.toHaveBeenCalled();
  });

  it("rejects a signature made with the wrong secret", async () => {
    const res = await handleClerkWebhook(
      signedRequest("user.created", userCreated, { secret: `whsec_${randomBytes(24).toString("base64")}` }),
    );
    expect(res.status).toBe(400);
    expect(mocked.upsertUser).not.toHaveBeenCalled();
  });

  it("rejects a body that does not match its signature", async () => {
    const req = signedRequest("user.created", userCreated);
    const tampered = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({ type: "user.created", data: { id: "evil" }, object: "event" }),
    });
    const res = await handleClerkWebhook(tampered);
    expect(res.status).toBe(400);
  });

  it("upserts the user and ensures a free workspace on user.created", async () => {
    const res = await handleClerkWebhook(signedRequest("user.created", userCreated));
    expect(res.status).toBe(200);
    expect(mocked.upsertUser).toHaveBeenCalledWith({
      id: "user_2abc",
      email: "maya@focus.fm",
      name: "Maya Lee",
    });
    expect(mocked.getOrCreateWorkspaceByOwner).toHaveBeenCalledWith("user_2abc");
    expect(mocked.markWebhookEventProcessed).toHaveBeenCalledWith(expect.any(String), "clerk");
  });

  it("upserts on user.updated too", async () => {
    const res = await handleClerkWebhook(signedRequest("user.updated", userCreated));
    expect(res.status).toBe(200);
    expect(mocked.upsertUser).toHaveBeenCalledOnce();
  });

  it("handles a user with no email and no name", async () => {
    const data = { ...userCreated, first_name: null, last_name: null, primary_email_address_id: null };
    await handleClerkWebhook(signedRequest("user.created", data));
    expect(mocked.upsertUser).toHaveBeenCalledWith({
      id: "user_2abc",
      email: "maya@focus.fm",
      name: null,
    });
  });

  it("deletes the user (and owned data via FK cascade) on user.deleted", async () => {
    const res = await handleClerkWebhook(
      signedRequest("user.deleted", { id: "user_2abc", object: "user", deleted: true }),
    );
    expect(res.status).toBe(200);
    expect(mocked.deleteClerkUser).toHaveBeenCalledWith("user_2abc");
  });

  it("ignores unhandled event types without touching users", async () => {
    const res = await handleClerkWebhook(
      signedRequest("session.created", { id: "sess_1", object: "session" }),
    );
    expect(res.status).toBe(200);
    expect(mocked.upsertUser).not.toHaveBeenCalled();
    expect(mocked.deleteClerkUser).not.toHaveBeenCalled();
    expect(mocked.markWebhookEventProcessed).toHaveBeenCalled();
  });

  it("skips already-processed event ids (idempotent redelivery)", async () => {
    mocked.isWebhookEventProcessed.mockResolvedValue(true);
    const res = await handleClerkWebhook(signedRequest("user.created", userCreated, { id: "msg_dup" }));
    expect(res.status).toBe(200);
    expect(mocked.upsertUser).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ received: true, duplicate: true });
  });
});
