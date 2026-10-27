// M13 / §7.5 — owner-only boundary for the admin AI routes. Reads the Clerk
// user from the auth context and checks its primary email against
// OWNER_EMAILS (comma/space-separated env).
//
// Deny-by-default tie-break (DECISIONS.md 2026-10-27 · WP-04): when Clerk is
// not configured (no keys — WP-02 ships the middleware) or OWNER_EMAILS is
// unset, the gate returns 503 and the route refuses. There is deliberately NO
// insecure fallback (header-based identity etc.); /admin lights up when WP-02
// auth + the env land.
export interface ClerkUserLike {
  id: string;
  primaryEmailAddress?: string | null;
}

export interface OwnerGateResult {
  ok: boolean;
  status: 200 | 401 | 403 | 503;
  reason:
    | "ok"
    | "unauthenticated"
    | "not_owner"
    | "owner_not_configured"
    | "auth_unavailable";
  email?: string;
}

export interface OwnerGateDeps {
  /** override for tests / alternate auth sources */
  currentUser?: () => Promise<ClerkUserLike | null>;
  ownerEmails?: string[];
  env?: NodeJS.ProcessEnv;
}

let warnedAuthUnavailable = false;

async function defaultCurrentUser(): Promise<ClerkUserLike | null> {
  // Align the availability check with WP-02's convention (lib/env.ts): without
  // both Clerk keys the app fails closed here — keyless previews never own AI
  // settings, even though app pages render with a preview user there.
  const { isClerkConfigured } = (await import("@/lib/env")) as {
    isClerkConfigured: () => boolean;
  };
  if (!isClerkConfigured()) {
    if (!warnedAuthUnavailable) {
      warnedAuthUnavailable = true;
      console.warn("[admin] Clerk not configured — admin AI routes stay locked (503).");
    }
    throw new Error("clerk_not_configured");
  }
  try {
    // @clerk/nextjs/server resolves under the Next.js bundler; in plain node
    // (unit tests) the import may fail and is treated as auth_unavailable.
    const mod = (await import("@clerk/nextjs/server")) as {
      currentUser: () => Promise<ClerkUserLike | null>;
    };
    return await mod.currentUser();
  } catch (err) {
    if (!warnedAuthUnavailable) {
      warnedAuthUnavailable = true;
      console.warn(
        "[admin] Clerk unavailable — admin AI routes stay locked:",
        err instanceof Error ? err.message : String(err),
      );
    }
    throw err;
  }
}

export function parseOwnerEmails(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireOwner(deps?: OwnerGateDeps): Promise<OwnerGateResult> {
  const env = deps?.env ?? process.env;
  const ownerEmails = deps?.ownerEmails ?? parseOwnerEmails(env.OWNER_EMAILS);
  if (!ownerEmails.length) {
    return { ok: false, status: 503, reason: "owner_not_configured" };
  }

  let user: ClerkUserLike | null;
  try {
    const getCurrent = deps?.currentUser ?? defaultCurrentUser;
    user = await getCurrent();
  } catch {
    return { ok: false, status: 503, reason: "auth_unavailable" };
  }
  if (!user) return { ok: false, status: 401, reason: "unauthenticated" };

  const email = (user.primaryEmailAddress ?? "").toLowerCase();
  if (!email || !ownerEmails.includes(email)) {
    return { ok: false, status: 403, reason: "not_owner", email: email || undefined };
  }
  return { ok: true, status: 200, reason: "ok", email };
}
