// Server-side PostHog capture via the documented /capture/ ingest API.
// DECISIONS.md 2026-10-27 · WP-09: plain fetch instead of the posthog-node
// package — zero new dependencies for one event type, and the ingest API is
// stable. Without NEXT_PUBLIC_POSTHOG_KEY this is a silent no-op (spec: no
// key → skip silently; the key is absent in every env today).
export const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

export function posthogConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_POSTHOG_KEY);
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
  opts?: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch },
): Promise<boolean> {
  const env = opts?.env ?? process.env;
  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return false;
  const host = env.POSTHOG_HOST || DEFAULT_POSTHOG_HOST;
  const doFetch = opts?.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: distinctId,
        properties,
        timestamp: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn("[posthog] capture failed:", err instanceof Error ? err.message : String(err));
    return false;
  }
}
