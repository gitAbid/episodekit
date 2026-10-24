// SermonKit engine tests — zero-dep, plain node. Run: npm test
import { readFileSync } from "node:fs";
import {
  generateSuiteDeterministic,
  analyzeSermon,
  normalizeWs,
} from "./lib.js";
import { validateSuite } from "./glm.js";
import { suiteToMarkdown, suiteToHtml } from "./index.js";

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log("  ✓", name); }
  else { failed++; console.error("  ✗ FAIL:", name); }
}

const sermon = readFileSync(new URL("../docs/samples/demo-sermon.txt", import.meta.url), "utf8");
const clean = normalizeWs(sermon.split("\n---")[0]); // strip CC0 footer; whitespace-normalized source of truth
const suite = generateSuiteDeterministic(clean);
const a = analyzeSermon(clean);

console.log("suite shape");
ok(suite.titles.length >= 5 && suite.titles.length <= 6, "titles: 5–6 candidates");
ok(typeof suite.summary.text === "string", "summary exists");
ok(suite.manuscript.sections.length >= 3, "manuscript has 3+ sections with headings");
ok(suite.discussionGuide.qs.length >= 4, "discussion guide has 4+ anchored questions");
ok(suite.devotionals.length === 5, "devotionals: exactly 5 days");
ok(suite.social.pullQuotes.length >= 2, "social: 2+ pull quotes");

console.log("honesty: every quote is an exact sentence from the sermon");
ok(suite.discussionGuide.qs.every((q) => clean.includes(q.quote)), "guide quotes verbatim");
ok(suite.devotionals.every((d) => clean.includes(d.anchor)), "devotional anchors verbatim");
ok(suite.social.pullQuotes.every((q) => clean.includes(q)), "pull quotes verbatim");

console.log("quality gates");
ok(suite.summary.wordCount >= 100 && suite.summary.wordCount <= 180, `summary 100–180 words (got ${suite.summary.wordCount})`);
ok(suite.social.xPosts.every((p) => p.text.length <= 280), "X posts ≤ 280 chars");
ok(suite.social.pullQuotes.every((q) => q.length >= 60), "pull quotes ≥ 60 chars");
ok(suite.manuscript.sections.every((s) => s.paragraphs.length >= 1 && s.paragraphs.join(" ").length > 50), "manuscript sections non-trivial");
const themeHits = suite.stats.themes.filter((t) => clean.toLowerCase().includes(t));
ok(themeHits.length >= 4, `themes are real sermon words (${themeHits.length}/5)`);

console.log("summary is extractive");
const sumSentences = suite.summary.text.split(/(?<=[.!?])\s+/);
ok(sumSentences.every((s) => clean.includes(s.trim())), "summary sentences verbatim from source");

console.log("glm validator");
const base = generateSuiteDeterministic(clean);
const honestAi = {
  titles: ["Custom Title One", "Custom Title Two", "Custom Title Three", "Custom Title Four"],
  summary: { text: clean.split(/(?<=[.!?])\s+/).slice(0, 8).join(" ") },
  devotionals: [{ title: "D", anchor: a.keyQuotes[0], reflection: "r", action: "a", prayer: "p" }],
  social: { pullQuotes: [a.keyQuotes[1], a.keyQuotes[2]] },
  discussionGuide: {
    title: "T", icebreaker: "i", open: ["o1", "o2", "o3"],
    qs: [{ quote: a.keyQuotes[3], follow: "f" }], prayer: "p",
  },
};
const v1 = validateSuite(honestAi, clean, base);
ok(v1.titles[0] === "Custom Title One", "valid AI titles accepted");
ok(v1.social.pullQuotes[0] === a.keyQuotes[1], "valid AI quotes accepted");
const liarAi = JSON.parse(JSON.stringify(honestAi));
liarAi.social.pullQuotes = ["This quote was never in the sermon, it is invented."];
liarAi.devotionals[0].anchor = "Also invented.";
const v2 = validateSuite(liarAi, clean, base);
ok(v2.social.pullQuotes[0] !== "This quote was never in the sermon, it is invented.", "invented pull quote rejected → deterministic fallback");
ok(v2.devotionals[0].anchor !== "Also invented.", "invented anchor rejected → deterministic fallback");
ok(validateSuite(null, clean, base) === null, "null AI → null (caller falls back)");

console.log("renderers");
const md = suiteToMarkdown(suite);
ok(md.includes("## Discussion guide") && md.includes("## Devotional series"), "markdown renders all sections");
const html = suiteToHtml(suite);
ok(html.includes("<!doctype html>") && html.includes("Discussion guide") && !html.includes("undefined"), "html renders without undefined leaks");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
