// M12 — Vercel BotID on the public tool routes.
//
// Configuration (verified against botid@1.5.11):
// - On Vercel (VERCEL set): real cryptographic check; the client page pairs
//   with <BotIdClient protect={[…]]> so human fetches carry proof-of-work.
// - Off Vercel (local `next start`, CI, self-hosted): there is no Vercel OIDC
//   token and checkBotId throws — so we pass isDevelopment + bypass:'HUMAN'.
// - If the check itself fails unexpectedly we FAIL OPEN with a console warn:
//   blocking every human because of an infra misconfiguration would break U16,
//   and the route still has the 5/day/IP limit + daily cost cap behind it.
// Logged in DECISIONS.md 2026-10-27 · WP-09.
export interface BotIdResult {
  /** false = request may proceed. */
  blocked: boolean;
  bypassed: boolean;
  reason: "bot" | "botid_unavailable" | null;
}

export async function verifyHuman(
  req: { headers: Headers },
  env: NodeJS.ProcessEnv = process.env,
): Promise<BotIdResult> {
  try {
    const { checkBotId } = await import("botid/server");
    const onVercel = Boolean(env.VERCEL);
    const res = await checkBotId({
      developmentOptions: { bypass: "HUMAN", isDevelopment: !onVercel },
      advancedOptions: { headers: Object.fromEntries(req.headers.entries()) },
    });
    if (res.isBot) return { blocked: true, bypassed: false, reason: "bot" };
    return { blocked: false, bypassed: res.bypassed, reason: null };
  } catch (err) {
    console.warn(
      "[tools] BotID unavailable — allowing request:",
      err instanceof Error ? err.message : String(err),
    );
    return { blocked: false, bypassed: true, reason: "botid_unavailable" };
  }
}
