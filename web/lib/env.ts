/**
 * Environment-driven configuration for WP-02 (auth + DB).
 *
 * Keys only ever come from env vars (01-product.md §0.5). When Clerk keys and
 * DATABASE_URL are BOTH absent (Vercel preview, CI, local dev without setup),
 * the app runs in documented "keyless preview" mode: auth resolves to a fixed
 * preview user and DB-backed calls degrade gracefully, so shells render.
 * If either is configured, real auth is enforced — the app fails closed.
 */
export const KEYLESS_USER_ID = "user_preview";

export function isClerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function isKeylessPreview(): boolean {
  return !isClerkConfigured() && !isDbConfigured();
}
