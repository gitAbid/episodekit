// Public checkout config — GET /api/config
// Returns Lemon Squeezy checkout URLs when configured; the app falls back to
// the founding-member email path otherwise.

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }
  return res.status(200).json({
    paymentsEnabled: Boolean(process.env.LS_PRO_URL),
    checkout: {
      pro: process.env.LS_PRO_URL || null,
      studio: process.env.LS_STUDIO_URL || null,
      founder: process.env.LS_FOUNDER_URL || null,
    },
  });
}
