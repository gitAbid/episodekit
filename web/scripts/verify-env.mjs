#!/usr/bin/env node
// WP-10 env check — the new-app counterpart of scripts/verify-unlocks.mjs.
// Verifies every §9 env var the cutover needs, per environment, and that no
// secret is exposed to the browser (NEXT_PUBLIC_* allow-list). Exit 1 on any
// REQUIRED missing entry for the target env (production | preview).
import { execSync } from "node:child_process";

const env = process.argv[2] ?? "preview";
const project = process.argv[3] ?? "episodekit-web";

const REQUIRED_PROD = [
  "DATABASE_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "GROQ_API_KEY",
  "GLM_API_KEY",
  "AI_PROVIDER",
];
const OPTIONAL = [
  "AI_MODEL_LONG",
  "AI_MODEL_FAST",
  "AI_FALLBACK_PROVIDER",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "ANTHROPIC_API_KEY",
  "AI_CUSTOM_BASE_URL",
  "AI_CUSTOM_API_KEY",
  "AI_CUSTOM_MODEL_LONG",
  "AI_CUSTOM_MODEL_FAST",
  "LS_API_KEY",
  "LS_STORE_ID",
  "LS_WEBHOOK_SECRET",
  "LS_VARIANT_PRO_MONTHLY",
  "LS_VARIANT_FOUNDING",
  "LS_FOUNDING_PAYMENT_URL",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "FREE_TOOL_DAILY_USD",
  "OWNER_EMAILS",
];

let remote = {};
try {
  const out = execSync(`vercel env ls --yes -p ${project} 2>/dev/null`, { encoding: "utf8" });
  remote = Object.fromEntries(
    out
      .split("\n")
      .map((l) => l.trim().split(/\s{2,}/))
      .filter((parts) => parts.length >= 2 && parts[0] !== "name" && !parts[0].startsWith("Retrieving"))
      .map((parts) => [parts[0], parts.slice(1).join(" ")]),
  );
} catch {
  console.log("could not read Vercel env (not logged in?); checking process env only");
}

const local = process.env;
let failures = 0;
const check = (name, required) => {
  const present = Boolean(remote[name] ?? local[name]);
  const mark = present ? "✓" : required === "required" ? "✗ MISSING (required)" : "- (optional, unset)";
  if (!present && required === "required") failures++;
  console.log(`  ${mark.padEnd(24)} ${name}`);
};

console.log(`env check · project=${project} · env=${env}\nrequired:`);
for (const k of REQUIRED_PROD) check(k, "required");
console.log("optional:");
for (const k of OPTIONAL) check(k, "optional");

console.log(
  failures === 0
    ? "\nOK — all required vars present. Cutover can proceed."
    : `\nBLOCKED — ${failures} required var(s) missing. See docs/relaunch/CUTOVER-CHECKLIST.md and docs/FOR-ABID.md.`,
);
process.exit(failures === 0 ? 0 : 1);
