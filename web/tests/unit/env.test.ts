import { afterEach, describe, expect, it } from "vitest";
import {
  isClerkConfigured,
  isDbConfigured,
  isKeylessPreview,
  KEYLESS_USER_ID,
} from "@/lib/env";

const CLERK_ENV = "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY";
const SECRET_ENV = "CLERK_SECRET_KEY";
const DB_ENV = "DATABASE_URL";

afterEach(() => {
  delete process.env[CLERK_ENV];
  delete process.env[SECRET_ENV];
  delete process.env[DB_ENV];
});

describe("env configuration helpers", () => {
  it("reports Clerk configured only when both publishable and secret keys exist", () => {
    process.env[CLERK_ENV] = "pk_test_x";
    expect(isClerkConfigured()).toBe(false);
    process.env[SECRET_ENV] = "sk_test_x";
    expect(isClerkConfigured()).toBe(true);
    delete process.env[CLERK_ENV];
    expect(isClerkConfigured()).toBe(false);
  });

  it("reports the DB configured from DATABASE_URL", () => {
    expect(isDbConfigured()).toBe(false);
    process.env[DB_ENV] = "postgres://user:pass@localhost/db";
    expect(isDbConfigured()).toBe(true);
  });

  it("is keyless preview only when Clerk and the DB are both absent", () => {
    expect(isKeylessPreview()).toBe(true);
    process.env[CLERK_ENV] = "pk_test_x";
    process.env[SECRET_ENV] = "sk_test_x";
    expect(isKeylessPreview()).toBe(false);
    delete process.env[CLERK_ENV];
    delete process.env[SECRET_ENV];
    process.env[DB_ENV] = "postgres://user:pass@localhost/db";
    expect(isKeylessPreview()).toBe(false);
  });

  it("exposes the fixed keyless preview user id", () => {
    expect(KEYLESS_USER_ID).toBe("user_preview");
  });
});
