// EpisodeKit deterministic suite engine — pure ESM, zero dependencies.
// Every artifact is built ONLY from the input text: quotes are exact sentences,
// summaries are extractive, titles come from the episode's own themes. Nothing
// is invented. This module is the keyless fallback AND the validator baseline
// for the GLM-enhanced path (glm.js).

const STOP = new Set(
  ("the a an and or but if then than that this these those of to in on for with as is are was were be been being it its his her their our your you we they he she i not no so at by from into about after before during under over between out up down here there what which who whom when where why how all any both each few more most other some such only own same too very can will just don should now may also let said says say unto us one two thing things something really actually there's it's we're you're they're don't can't won't ours yours theirs " +
    // episode meta-language: words about the show, not the content
    "episode podcast show today tonight morning room want know like come going still never always someone everyone anybody nobody another without within maybe perhaps those these listener listeners audience guys thanks welcome back everyone's " +
    // rhetorical markers that pollute theme lists
    "because therefore notice remember imagine means takeaway here's " +
    // light verbs that pollute theme lists
    "comes coming want wants wanted mean means meant take takes taken make makes made give gives gave look looks looking feel feels felt think thinks thought").split(" ")
);

export function normalizeWs(t) {
  return String(t).replace(/\s+/g, " ").trim();
}

export function words(t) {
  return (t.toLowerCase().match(/[a-z']+/g) || []);
}

export function sentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z"'“])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && s.length < 420);
}

export function themes(text, n = 10) {
  const f = new Map();
  for (let w of words(text)) {
    w = w.replace(/'s$/, ""); // merge possessives into the base word
    if (w.length < 4 || STOP.has(w)) continue;
    f.set(w, (f.get(w) || 0) + 1);
  }
  return [...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0]);
}

function titleCase(w) {
  return w[0].toUpperCase() + w.slice(1);
}

// Rank sentences by theme coverage; boost rhetorical markers (the sentences a
// content pack should anchor on: reasons, takeaways, calls to action).
export function rankedSentences(sents, themeWords) {
  const tset = new Set(themeWords);
  return sents
    .map((s, i) => {
      const ws = words(s);
      let score = 0;
      for (const w of ws) if (tset.has(w)) score += 1;
      score /= Math.sqrt(ws.length);
      if (/\b(because|therefore|the key is|here's why|remember|notice|imagine|means|choose|this week|takeaway)\b/i.test(s)) score *= 1.3;
      return { s, i, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function analyzeTranscript(rawText) {
  const text = normalizeWs(rawText); // single whitespace-normalized source of truth
  const sents = sentences(text);
  const th = themes(text, 10).filter((t) => t.length >= 5);
  const ranked = rankedSentences(sents, th);
  // Key quotes: top-scored, returned in episode order, deduped.
  const keyQuotes = ranked.slice(0, 12).sort((a, b) => a.i - b.i).map((r) => r.s);
  // Segments: split the episode into 3–5 contiguous chunks; label each with its
  // own dominant theme (honest labels — the theme IS what that chunk is about).
  const segmentCount = Math.max(3, Math.min(5, Math.round(sents.length / 8)));
  const per = Math.ceil(sents.length / segmentCount);
  const segments = [];
  const usedLabels = new Set();
  for (let m = 0; m < segmentCount; m++) {
    const chunk = sents.slice(m * per, (m + 1) * per);
    if (!chunk.length) continue;
    const localThemes = themes(chunk.join(" "), 3).filter((t) => t.length >= 5);
    let label = localThemes[0] || th[m] || "the episode";
    if (usedLabels.has(label) && localThemes[1]) label = localThemes[1];
    usedLabels.add(label);
    segments.push({
      label: m === 0 ? `Opening: ${titleCase(label)}` : titleCase(label),
      sents: chunk,
    });
  }
  return { sents, themes: th, keyQuotes, segments, wordCount: words(text).length };
}

export function buildArticle(rawText, a) {
  const title = `${titleCase(a.themes[0] || "Episode")} — ${titleCase(a.themes[1] || "takeaways")}`;
  const sections = a.segments.map((m) => ({
    heading: m.label,
    paragraphs: splitParagraphs(m.sents),
  }));
  return { title, sections };
}

function splitParagraphs(sents) {
  // Group ~4 sentences per paragraph.
  const out = [];
  for (let i = 0; i < sents.length; i += 4) out.push(sents.slice(i, i + 4).join(" "));
  return out;
}

export function buildDiscussionKit(a) {
  const [t1, t2, t3] = [a.themes[0] || "this episode", a.themes[1] || "this week", a.themes[2] || "the topic"];
  const open = [
    `Where does ${t1} show up in your own work or life right now?`,
    `The episode pressed into ${t2}. What about that challenged or confirmed what you thought?`,
    `If ${t3} became real for you this month, what would change first?`,
  ];
  const followUps = [
    "What stands out to you in that moment, and why?",
    "Do you agree? What would you add or push back on?",
    "Where have you seen this play out — or fail — in your own experience?",
    "If you acted on this tomorrow, what would be the first thing to break?",
    "Who in your world would push back hardest on this — and what would their objection be?",
    "What's the smallest version of this idea you could test this week?",
  ];
  const qs = a.keyQuotes.slice(0, 6).map((q, i) => ({ quote: q, follow: followUps[i % followUps.length] }));
  const applyPool = [
    `What is one concrete step you can take this week based on ${t1}?`,
    `Who do you know that needs to hear this episode — and what will you tell them about it?`,
    `Where did this episode catch you doing the opposite of what it recommends? Be specific.`,
    `Set a check-in: what will have changed by next time you meet if you acted on ${t1}?`,
  ];
  return {
    title: `Discussion Kit — ${titleCase(t1)}${t2 ? " & " + titleCase(t2) : ""}`,
    opener: `In one sentence: what did you take away from this episode?`,
    open,
    qs,
    apply: [applyPool[0], applyPool[1 + (a.themes.length % 3)]],
    closing: `Close by having everyone share the one thing they're going to try first, and check in on it next time you meet.`,
  };
}

// 5-day email series: each day anchored on an exact quote, reflection built
// from adjacent real sentences, one action, one closing line. Nothing invented.
export function buildEmailSeries(a) {
  const dayActions = [
    (t) => `Write down where you ran into ${t} this week, and one thing you'd do differently.`,
    (t) => `Tell one colleague or friend what you learned about ${t} — explaining it is how it sticks.`,
    (t) => `Pick the smallest possible experiment around ${t} and run it today.`,
    (t) => `Do one small act today that applies ${t} — something nobody would notice but you.`,
    (t) => `Look back on the week: note one moment where ${t} actually changed what you did. Write it down.`,
  ];
  const anchors = a.keyQuotes.slice(0, 5);
  while (anchors.length < 5 && a.sents.length) anchors.push(a.sents[anchors.length % a.sents.length]);
  return anchors.map((quote, i) => {
    const idx = a.sents.indexOf(quote);
    const refl = a.sents.slice(Math.max(0, idx - 1), Math.max(0, idx - 1) + 3).join(" ") || quote;
    const theme = a.themes[i % a.themes.length] || "the topic";
    return {
      day: i + 1,
      title: `Day ${i + 1}: ${titleCase(theme)}`,
      anchor: quote,
      reflection: refl,
      action: dayActions[i](theme),
      closing: `Reply and tell us what you think — we read everything.`,
    };
  });
}

export function buildSocialPack(a) {
  const clean = (s) => s.replace(/^[ "'“]+|[ "'”]+$/g, "");
  const candidates = a.keyQuotes
    .map(clean)
    .filter((q) => q.length >= 60 && q.length <= 220);
  const pullQuotes = candidates.slice(0, 3);
  const tags = a.themes.slice(0, 3).map((t) => "#" + t.replace(/[^a-z0-9]/gi, ""));
  const captions = pullQuotes.map((q) => ({
    platform: "any",
    text: `This week's episode in one line:\n\n“${q}”\n\nFull episode + show notes on our site. ${tags.join(" ")}`,
  }));
  const xPosts = pullQuotes.map((q) => {
    let text = `“${q}” ${tags.slice(0, 2).join(" ")}`;
    if (text.length > 280) text = `“${q.slice(0, 250)}…” ${tags[0] || ""}`;
    return { platform: "x", text: text.trim().slice(0, 280) };
  });
  return { pullQuotes, captions, xPosts, tags };
}

export function buildSummary(a) {
  // Extractive ~150-word summary: top-ranked sentences, episode order.
  const target = 150;
  const picked = [];
  let wc = 0;
  for (const r of a.ranked || rankedSentences(a.sents, a.themes)) {
    const len = words(r.s).length;
    if (wc + len > target + 25) continue;
    picked.push(r);
    wc += len;
    if (wc >= target - 30) break;
  }
  const ordered = picked.sort((x, y) => x.i - y.i).map((r) => r.s);
  return { text: ordered.join(" "), wordCount: wc };
}

export function buildTitles(a) {
  const t = a.themes.map(titleCase);
  const out = [
    `${t[0]} and ${t[1] || "Trade-offs"}`,
    `The ${t[0]} We Keep Avoiding`,
    `What ${t[1] || "Everyone"} Gets Wrong About ${t[0]}`,
    `${t[2] || t[1] || "Focus"} Changes Everything`,
    `${t[0]} for Ordinary Weeks`,
    `Why ${t[0]} Matters`,
  ];
  const firstQuote = a.keyQuotes[0];
  if (firstQuote) {
    const frag = firstQuote.split(/[,.;:—]/)[0].trim();
    if (frag.length >= 12 && frag.length <= 48) out.push(titleCase(frag.toLowerCase()));
  }
  return out.slice(0, 6);
}

export function generateSuiteDeterministic(rawText) {
  const a = analyzeTranscript(rawText);
  a.ranked = rankedSentences(a.sents, a.themes);
  return {
    engine: "offline",
    generatedAt: new Date().toISOString(),
    stats: { words: a.wordCount, sentences: a.sents.length, themes: a.themes.slice(0, 5) },
    titles: buildTitles(a),
    summary: buildSummary(a),
    article: buildArticle(rawText, a),
    discussion: buildDiscussionKit(a),
    series: buildEmailSeries(a),
    social: buildSocialPack(a),
  };
}
