# Lemon Squeezy Activation Runbook — EpisodeKit

Goal: after this runbook, checkout is live and buyers automatically receive
working license keys. The code side is done and tested (62 tests); this is the
exact click-path. Estimated 15 minutes.

## 1. Create the store (3 min)
1. https://lemonsqueezy.com → Sign up (email + password; store name:
   **EpisodeKit**, currency USD).
2. Settings → Billing → complete payout details when prompted (can finish
   after first sale; required before payout).

## 2. Create 3 products + variants (5 min)
Products → New product. For each row below: create the product, then keep the
**default variant** (rename as noted) and note its **Variant ID** (product
page → the variant's ⚙️ → the numeric ID in the URL or API section).

| Product | Variant name | Price | Billing | Variant ID goes to |
|---|---|---|---|---|
| EpisodeKit Pro | Pro monthly | $19 | Subscription, monthly | `LS_PRO_VARIANT` |
| EpisodeKit Studio | Studio monthly | $49 | Subscription, monthly | `LS_STUDIO_VARIANT` |
| EpisodeKit Founder | Founder — lifetime | $49 | One-time (first 50) | `LS_FOUNDER_VARIANT` |

For the Founder product, enable **"Limit quantity"** = 50 if you want the
scarcity to be real (recommended).

## 3. Checkout links (2 min)
Each variant → **Buy link** (or Settings → Payments if customizing). You get
`https://episodekit.lemonsqueezy.com/buy/<uuid>` URLs — one per variant.

## 4. Webhook (2 min)
1. Settings → Webhooks → **+ New**.
2. URL: `https://episodekit.vercel.app/api/ls-webhook`
3. Events: tick **Order created** (others optional — non-order events are
   safely ignored by our handler).
4. **Signing secret**: LS shows it after saving — copy it.
5. Test: click **Send test** on the webhook → our endpoint returns 200 and
   logs `sk_license` (check Vercel dashboard → Logs).

## 5. Environment variables (3 min)
Vercel dashboard → project **episodekit** → Settings → Environment Variables
(add each to **Production**):

```
LS_WEBHOOK_SECRET   = <the signing secret from step 4>
LS_PRO_URL          = <buy link, Pro>
LS_STUDIO_URL       = <buy link, Studio>
LS_FOUNDER_URL      = <buy link, Founder>
LS_VARIANTS         = {"<pro-variant-id>":"pro","<studio-variant-id>":"studio","<founder-variant-id>":"founder"}
```
Then **Deployments → ⋯ → Redeploy** (env vars apply on next deploy).

While you're here (separate unlock): `GLM_API_KEY` (AI-enhanced artifacts)
and `ASR_API_KEY` + `ASR_PROVIDER` (`deepgram` or `groq`) — see README.

## 6. How the buyer gets their license key
Our webhook issues an HMAC license key (SK1…/SK4…/SKF…) per order and logs it.
Fastest zero-config delivery: in LS → product → **Email receipts** are
automatic, but they don't include the key. Two options:
- **Now (recommended, 1 min):** Settings → Store → Custom receipt message:
  "Your license key is on its way — email founders@episodekit.app with your
  order number and we'll send it instantly." (The key is already issued and
  waiting in the logs; the founding volume is low.)
- **Later:** switch delivery to LS's native License Keys or an email API —
  the webhook handler is the only place to touch (`api/ls-webhook.js`).

## 7. Verify end-to-end (2 min)
1. LS → product → **... → Test payment** (LS provides a test card flow).
2. Confirm in Vercel → Logs: a `sk_license` line with your plan.
3. On https://episodekit.vercel.app/app — run 3 generations to exhaust the
   free quota, click **Activate**, paste the key from the log line →
   "License active — pro (12 episodes/month)."
4. Pricing card on the landing now shows real checkout buttons (they render
   automatically once `LS_PRO_URL` exists).

## Common pitfalls
- Redepl.oied before adding vars? Env changes need a fresh deploy.
- Variant IDs are numeric; `LS_VARIANTS` must be valid JSON (double quotes).
- Webhook secret ≠ API key — you want the **signing secret**.
