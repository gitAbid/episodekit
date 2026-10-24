// EpisodeKit CLI — node engine/cli.js <transcript.txt> [--json out.json] [--md out.md] [--html out.html]
import { readFileSync, writeFileSync } from "node:fs";
import { generateSuite, suiteToMarkdown, suiteToHtml } from "./index.js";

const [input, ...flags] = process.argv.slice(2);
if (!input || flags.includes("-h") || flags.includes("--help")) {
  console.log("usage: node engine/cli.js <transcript.txt> [--json out.json] [--md out.md] [--html out.html]");
  process.exit(input ? 0 : 1);
}
// Content below a standalone "---" line is treated as file metadata (license etc.)
const text = readFileSync(input, "utf8").split(/\n---\n?/)[0];
const suite = await generateSuite(text);
console.error(`engine=${suite.engine} words_in=${suite.stats.words}`);
for (let i = 0; i < flags.length; i++) {
  if (flags[i] === "--json") writeFileSync(flags[i + 1], JSON.stringify(suite, null, 2));
  if (flags[i] === "--md") writeFileSync(flags[i + 1], suiteToMarkdown(suite));
  if (flags[i] === "--html") writeFileSync(flags[i + 1], suiteToHtml(suite));
}
if (!flags.length) console.log(JSON.stringify(suite, null, 2));
