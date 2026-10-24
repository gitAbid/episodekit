// License validation — GET /api/license?key=SK1-... → { valid, plan, monthlySermons }

import { validateLicense } from "./license-keys.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }
  const url = new URL(req.url || "", "http://x");
  const key = url.searchParams.get("key") || "";
  const result = await validateLicense(key);
  if (result.valid) {
    console.log(JSON.stringify({ sk_license: { t: Date.now(), event: "validated", plan: result.plan } }));
  }
  return res.status(result.valid ? 200 : 404).json(result);
}
