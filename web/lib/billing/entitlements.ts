// Founding counter (landing MK-1: "Founding: $99/yr — N of 100 left").
//
// STUB SEAM for WP-08 (billing): this module is the documented entitlements
// interface the billing WP will implement. WP-09 renders the counter ONLY
// from this boundary, never as a literal. Config source: FOUNDING_SOLD (plans
// already claimed; default 0 — true today, no Founding plans exist yet).
// WP-08 replaces the implementation with the DB-derived count of workspaces
// with founding=true; the landing page keeps importing this module unchanged.
export const FOUNDING_TOTAL = 100;

export interface EntitlementsProvider {
  /** Remaining Founding Pro plans, clamped to [0, FOUNDING_TOTAL]. */
  foundingRemaining(): Promise<number>;
}

export function configEntitlements(env: NodeJS.ProcessEnv = process.env): EntitlementsProvider {
  return {
    async foundingRemaining(): Promise<number> {
      const sold = Number.parseInt(env.FOUNDING_SOLD ?? "0", 10);
      const valid = Number.isFinite(sold) && sold > 0 ? sold : 0;
      return Math.max(0, Math.min(FOUNDING_TOTAL, FOUNDING_TOTAL - valid));
    },
  };
}

/** Convenience for server components. */
export async function foundingRemaining(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  return configEntitlements(env).foundingRemaining();
}
