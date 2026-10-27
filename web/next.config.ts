import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // PGlite must stay outside the server bundle: its wasm loader resolves
  // internal URLs at runtime and breaks when Turbopack inlines it.
  serverExternalPackages: ["@electric-sql/pglite"],
  // cacheComponents disabled (DECISIONS.md WP-06): its runtime PPR replay
  // guard trips Date.now() in streamed per-user pages; connection()+Suspense
  // patterns used across the app work identically with it off.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
