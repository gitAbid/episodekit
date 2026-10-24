// Public config — GET /api/config
// Reports checkout URLs (Lemon Squeezy) and whether audio transcription is
// configured. The app uses audioEnabled to default to the paste tab and to
// message the audio tab honestly before an ASR key exists.

import { providerFor, keyFor } from "./asr.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }
  const provider = providerFor(process.env);
  const audioEnabled = Boolean(provider && keyFor(provider, process.env));
  return res.status(200).json({
    paymentsEnabled: Boolean(process.env.LS_PRO_URL),
    audioEnabled,
    checkout: {
      pro: process.env.LS_PRO_URL || null,
      studio: process.env.LS_STUDIO_URL || null,
      founder: process.env.LS_FOUNDER_URL || null,
    },
  });
}
