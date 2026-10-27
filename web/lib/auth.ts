import { redirect } from "next/navigation";
import { isClerkConfigured, isKeylessPreview, KEYLESS_USER_ID } from "./env";

/** Shown on /sign-in (and /sign-up) when Clerk keys are not configured. */
export const KEYLESS_PREVIEW_MESSAGE = "Sign in isn't set up in this preview.";

/**
 * Resolve the acting user id, or null when unauthenticated.
 *
 * - Clerk configured: real auth() (server-side; requires proxy.ts middleware).
 * - Keyless preview (no Clerk keys AND no DATABASE_URL): fixed preview user so
 *   shells render on previews/CI without faking a provider. Documented in
 *   DECISIONS.md; fails closed when only the DB is configured.
 */
export async function getAuthUserId(): Promise<string | null> {
  if (isClerkConfigured()) {
    const { auth } = await import("@clerk/nextjs/server");
    return (await auth()).userId ?? null;
  }
  if (isKeylessPreview()) return KEYLESS_USER_ID;
  // e2e seam (DECISIONS.md 2026-10-27 · WP-06): honored ONLY when Clerk is
  // absent AND the database is an embedded test instance (pglite: scheme) —
  // it can never authenticate anyone against a real database, preserving the
  // fail-closed rule above.
  if (
    !isClerkConfigured() &&
    process.env.E2E_AUTH_USER_ID &&
    (process.env.DATABASE_URL ?? "").startsWith("pglite:")
  ) {
    return process.env.E2E_AUTH_USER_ID;
  }
  return null;
}

/** For pages: redirect to sign-in when there is no user. */
export async function requireUser(): Promise<string> {
  const userId = await getAuthUserId();
  if (!userId) redirect("/sign-in");
  return userId;
}
