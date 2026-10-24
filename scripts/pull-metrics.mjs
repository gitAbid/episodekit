#!/usr/bin/env node
// Launch-day metrics pull: aggregates sk_* events from Vercel function logs.
// Usage: node scripts/pull-metrics.mjs [seconds=20]
// `vercel logs` streams forever, so we collect for N seconds then parse.
import { spawn } from "node:child_process";

const seconds = Number(process.argv[2] || 20);
const child = spawn("vercel", ["logs", "https://episodekit.vercel.app"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let raw = "";
child.stdout.on("data", (d) => (raw += d));
const kill = setTimeout(() => child.kill("SIGKILL"), seconds * 1000);
child.on("close", () => {
  clearTimeout(kill);
  let usage = 0, pageviews = 0, waitlist = 0, contact = 0, licenses = 0;
  for (const line of raw.split("\n")) {
    const m = line.match(/\{[^{}]*sk_[a-z]+[^{}]*\}/);
    if (!m) continue;
    try {
      const j = JSON.parse(m[0]);
      if (j.sk_usage) usage++;
      else if (j.sk_event) pageviews++;
      else if (j.sk_waitlist) waitlist++;
      else if (j.sk_contact) contact++;
      else if (j.sk_license) licenses++;
    } catch {}
  }
  const row = `| ${new Date().toISOString().slice(0, 16).replace("T", " ")} | ${pageviews} (log) | — | ${waitlist} | ${usage} | contact:${contact} licenses:${licenses} | pull-metrics ${seconds}s window |`;
  console.log(row);
  console.error(`pageviews:${pageviews} usage:${usage} waitlist:${waitlist} contact:${contact} licenses:${licenses} (recent-log window; run repeatedly on launch days)`);
  process.exit(0);
});
