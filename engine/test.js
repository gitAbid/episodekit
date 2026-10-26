// EpisodeKit engine tests — zero-dep, plain node. Run: npm test
import { readFileSync } from "node:fs";
import {
  generateSuiteDeterministic,
  analyzeTranscript,
  normalizeWs,
  stripSpeakerLabels,
} from "./lib.js";
import { validateSuite } from "./glm.js";
import { suiteToMarkdown, suiteToHtml } from "./index.js";

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log("  ✓", name); }
  else { failed++; console.error("  ✗ FAIL:", name); }
}

const episode = readFileSync(new URL("../docs/samples/demo-episode.txt", import.meta.url), "utf8");
const clean = normalizeWs(episode.split("\n---")[0]); // strip CC0 footer; whitespace-normalized source of truth
const suite = generateSuiteDeterministic(clean);
const a = analyzeTranscript(clean);

console.log("suite shape");
ok(suite.titles.length >= 5 && suite.titles.length <= 6, "titles: 5–6 candidates");
ok(typeof suite.summary.text === "string", "summary exists");
ok(suite.article.sections.length >= 3, "article has 3+ sections with headings");
ok(suite.discussion.qs.length >= 4, "discussion kit has 4+ anchored questions");
ok(suite.series.length === 5, "email series: exactly 5 days");
ok(suite.social.pullQuotes.length >= 2, "social: 2+ pull quotes");

console.log("honesty: every quote is an exact sentence from the episode");
ok(suite.discussion.qs.every((q) => clean.includes(q.quote)), "discussion quotes verbatim");
ok(suite.series.every((d) => clean.includes(d.anchor)), "series anchors verbatim");
ok(suite.social.pullQuotes.every((q) => clean.includes(q)), "pull quotes verbatim");

console.log("no religious terminology anywhere in output");
const flat = JSON.stringify(suite).toLowerCase();
ok(!/sermon|church|devotional|prayer|jesus|god\b|pastor/.test(flat), "output is religion-free");

console.log("quality gates");
ok(suite.summary.wordCount >= 100 && suite.summary.wordCount <= 180, `summary 100–180 words (got ${suite.summary.wordCount})`);
ok(suite.social.xPosts.every((p) => p.text.length <= 280), "X posts ≤ 280 chars");
ok(suite.social.pullQuotes.every((q) => q.length >= 60), "pull quotes ≥ 60 chars");
ok(suite.article.sections.every((s) => s.paragraphs.length >= 1 && s.paragraphs.join(" ").length > 50), "article sections non-trivial");
const themeHits = suite.stats.themes.filter((t) => clean.toLowerCase().includes(t));
ok(themeHits.length >= 4, `themes are real episode words (${themeHits.length}/5)`);

console.log("summary is extractive");
const sumSentences = suite.summary.text.split(/(?<=[.!?])\s+/);
ok(sumSentences.every((s) => clean.includes(s.trim())), "summary sentences verbatim from source");

console.log("glm validator");
const base = generateSuiteDeterministic(clean);
const honestAi = {
  titles: ["Custom Title One", "Custom Title Two", "Custom Title Three", "Custom Title Four"],
  summary: { text: clean.split(/(?<=[.!?])\s+/).slice(0, 8).join(" ") },
  series: [{ title: "D", anchor: a.keyQuotes[0], reflection: "r", action: "a", closing: "c" }],
  social: { pullQuotes: [a.keyQuotes[1], a.keyQuotes[2]] },
  discussion: {
    title: "T", opener: "o", open: ["o1", "o2", "o3"],
    qs: [{ quote: a.keyQuotes[3], follow: "f" }], closing: "c",
  },
};
const v1 = validateSuite(honestAi, clean, base);
ok(v1.titles[0] === "Custom Title One", "valid AI titles accepted");
ok(v1.social.pullQuotes[0] === a.keyQuotes[1], "valid AI quotes accepted");
const liarAi = JSON.parse(JSON.stringify(honestAi));
liarAi.social.pullQuotes = ["This quote was never in the episode, it is invented."];
liarAi.series[0].anchor = "Also invented.";
const v2 = validateSuite(liarAi, clean, base);
ok(v2.social.pullQuotes[0] !== "This quote was never in the episode, it is invented.", "invented pull quote rejected → deterministic fallback");
ok(v2.series[0].anchor !== "Also invented.", "invented anchor rejected → deterministic fallback");
ok(validateSuite(null, clean, base) === null, "null AI → null (caller falls back)");

console.log("validator tolerance for LLM punctuation habits");
const q0 = a.keyQuotes[0];
const styledAi = JSON.parse(JSON.stringify(honestAi));
styledAi.social.pullQuotes = [
  q0.replace(/"/g, "\u201C").replace(/'/g, "\u2019").replace(/ - /g, " \u2014 ") + "",
  q0.slice(0, -1) + "\u2026",
];
const v3 = validateSuite(styledAi, clean, base);
ok(v3.social.pullQuotes.some(q => q.includes("\u201C") || q.endsWith("\u2026")), "curly-quoted / ellipsized verbatim quotes accepted (no silent fallback)");
const liarAi2 = JSON.parse(JSON.stringify(honestAi));
liarAi2.social.pullQuotes = [q0.replace(/\bthe\b/g, "a").replace(/\bis\b/g, "was")];
ok(validateSuite(liarAi2, clean, base).social.pullQuotes.every(q => q === base.social.pullQuotes[0] || base.social.pullQuotes.includes(q)), "punctuation-normalized but paraphrased quote still rejected");

console.log("renderers");
const md = suiteToMarkdown(suite);
ok(md.includes("## Article (show notes)") && md.includes("## Email series (5 days)"), "markdown renders all sections");
const html = suiteToHtml(suite);
ok(html.includes("<!doctype html>") && html.includes("Discussion kit") && !html.includes("undefined"), "html renders without undefined leaks");
ok(!/sermon|church|devotional/i.test(md + html), "rendered output is religion-free");

console.log("speaker-labeled transcripts (real ASR shape)");
const labeled = "Speaker 1: Welcome back to the show. Today we are talking about deep work and why focus is the most expensive resource in modern work. Host: Nobody budgets attention like money, and that is the whole problem we unpack today. Speaker 2: I think the calendar is the real fix because a to-do item is a wish while a calendar block is a promise. Speaker 1: Remember the research on task switching, because one notification can cost you twenty minutes of real depth. Host: So subtraction beats addition, and the professional with three tools out-ships the one with thirty.";
const labeledClean = normalizeWs(stripSpeakerLabels(labeled));
const labeledSuite = generateSuiteDeterministic(labeled);
ok(!labeledSuite.stats.themes.includes("speaker"), "'speaker' not a theme");
ok(labeledSuite.discussion.qs.every((q) => labeledClean.includes(q.quote)), "labeled-transcript quotes verbatim vs label-free source");
ok(labeledSuite.stats.themes.includes("calendar") || labeledSuite.stats.themes.includes("attention"), "real themes surface");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
