#!/usr/bin/env bash
# WP-10 cutover — moves the legacy product to legacy/ and re-points the repo
# at the new web/ app. NOT run automatically: it changes what the LIVE
# deployment serves. Preconditions are in docs/relaunch/CUTOVER-CHECKLIST.md;
# `node web/scripts/verify-env.mjs production episodekit-web` must pass first.
set -euo pipefail
cd "$(dirname "$0")"

echo "== 1/4 verify env (production) =="
node web/scripts/verify-env.mjs production episodekit-web

echo "== 2/4 move legacy product (site/ api/ engine/ -> legacy/) =="
git mv site legacy/site
git mv api legacy/api
git mv engine legacy/engine
git rm -q vercel.json   # legacy static hosting config; web/ brings its own

echo "== 3/4 record =="
git commit -m "cutover: move legacy product to legacy/ (WP-10)"

echo "== 4/4 remaining manual steps (docs/relaunch/CUTOVER-CHECKLIST.md) =="
echo "  - Vercel project 'episodekit': disconnect repo (or point it at legacy/) so the old deploy stops"
echo "  - Vercel project 'episodekit-web': Root Directory = web/, Production branch = main, then promote"
echo "  - Re-run: pnpm --dir web exec drizzle-kit migrate   (production DATABASE_URL)"
echo "  - Verify: /, /tools/show-notes (200), sign-up, sample episode end-to-end"
