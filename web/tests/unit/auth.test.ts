import { afterEach, describe, expect, it } from "vitest";
import { getAuthUserId, KEYLESS_PREVIEW_MESSAGE } from "@/lib/auth";
import { KEYLESS_USER_ID } from "@/lib/env";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.DATABASE_URL;
});

describe("getAuthUserId", () => {
  it("returns the fixed preview user in keyless mode", async () => {
    expect(await getAuthUserId()).toBe(KEYLESS_USER_ID);
  });

  it("fails closed when the DB is configured without Clerk", async () => {
    process.env.DATABASE_URL = "postgres://test";
    expect(await getAuthUserId()).toBeNull();
  });
});

describe("KEYLESS_PREVIEW_MESSAGE", () => {
  it("explains the preview state in plain second person", () => {
    expect(KEYLESS_PREVIEW_MESSAGE).toBe("Sign in isn't set up in this preview.");
  });
});
