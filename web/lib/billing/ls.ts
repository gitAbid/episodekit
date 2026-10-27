/**
 * Lemon Squeezy API client — the single fetch boundary for billing (WP-08).
 * Shapes verified against docs.lemonsqueezy.com/api (JSON:API, v1):
 * - POST /v1/checkouts        → data.attributes.url
 * - DELETE /v1/subscriptions/:id → cancelled subscription object
 * Keys come only from env (LS_API_KEY, LS_STORE_ID, §9). The whole client is
 * injectable so tests and the keyless preview never touch the network.
 */

const LS_API_BASE = "https://api.lemonsqueezy.com/v1";

export type LsCheckoutInput = {
  storeId: string;
  variantId: string;
  /** Prefill + custom data; `custom` reappears as meta.custom_data in webhooks. */
  email?: string;
  name?: string;
  custom: Record<string, string>;
};

export type LsCancelResult = {
  status: string;
  endsAt: Date | null;
  /** Signed, ~24 h links for [Manage payment] (urls.customer_portal). */
  customerPortalUrl: string | null;
  updatePaymentMethodUrl: string | null;
};

export type LsSubscriptionInfo = {
  status: string;
  renewsAt: Date | null;
  endsAt: Date | null;
  customerPortalUrl: string | null;
  updatePaymentMethodUrl: string | null;
};

export type LsClient = {
  createCheckout(input: LsCheckoutInput): Promise<{ url: string }>;
  cancelSubscription(subscriptionId: string): Promise<LsCancelResult>;
  /** Read for the MK-9 [Manage payment] button (signed ~24 h portal links). */
  getSubscription(subscriptionId: string): Promise<LsSubscriptionInfo>;
};

function jsonApiHeaders(apiKey: string): HeadersInit {
  return {
    Accept: "application/vnd.api+json",
    "Content-Type": "application/vnd.api+json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function parseSubscription(body: { data?: { attributes?: Record<string, unknown> } }): LsSubscriptionInfo {
  const attrs = (body.data?.attributes ?? {}) as Record<string, unknown>;
  const urls = (attrs.urls ?? {}) as Record<string, string | null>;
  return {
    status: typeof attrs.status === "string" ? attrs.status : "unknown",
    renewsAt: typeof attrs.renews_at === "string" ? new Date(attrs.renews_at) : null,
    endsAt: typeof attrs.ends_at === "string" ? new Date(attrs.ends_at) : null,
    customerPortalUrl: urls.customer_portal ?? null,
    updatePaymentMethodUrl: urls.update_payment_method ?? null,
  };
}

export const httpLsClient: LsClient = {
  async createCheckout(input) {
    const res = await fetch(`${LS_API_BASE}/checkouts`, {
      method: "POST",
      headers: jsonApiHeaders(requireApiKey()),
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_options: { embed: false, dark: false, locale: "en" },
            checkout_data: {
              ...(input.email ? { email: input.email } : {}),
              ...(input.name ? { name: input.name } : {}),
              custom: input.custom,
            },
          },
          relationships: {
            store: { data: { type: "stores", id: input.storeId } },
            variant: { data: { type: "variants", id: input.variantId } },
          },
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`LS checkout failed: ${res.status}`);
    }
    const body = (await res.json()) as { data?: { attributes?: { url?: string } } };
    const url = body.data?.attributes?.url;
    if (!url) throw new Error("LS checkout response had no url");
    return { url };
  },

  async cancelSubscription(subscriptionId) {
    const res = await fetch(`${LS_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "DELETE",
      headers: jsonApiHeaders(requireApiKey()),
    });
    if (!res.ok) {
      throw new Error(`LS cancel failed: ${res.status}`);
    }
    const body = (await res.json()) as {
      data?: { attributes?: { status?: string; ends_at?: string | null; urls?: Record<string, string | null> } };
    };
    const attrs = body.data?.attributes ?? {};
    return {
      status: attrs.status ?? "cancelled",
      endsAt: attrs.ends_at ? new Date(attrs.ends_at) : null,
      customerPortalUrl: attrs.urls?.customer_portal ?? null,
      updatePaymentMethodUrl: attrs.urls?.update_payment_method ?? null,
    };
  },

  async getSubscription(subscriptionId) {
    const res = await fetch(`${LS_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      headers: jsonApiHeaders(requireApiKey()),
    });
    if (!res.ok) {
      throw new Error(`LS subscription fetch failed: ${res.status}`);
    }
    return parseSubscription((await res.json()) as { data?: { attributes?: Record<string, unknown> } });
  },
};

function requireApiKey(): string {
  const key = process.env.LS_API_KEY;
  if (!key) throw new Error("LS_API_KEY is not set. See web/.env.example.");
  return key;
}

/** True when checkout/cancel API calls are possible (keys + store present). */
export function isLsConfigured(): boolean {
  return Boolean(process.env.LS_API_KEY && process.env.LS_STORE_ID);
}
