// SermonKit deterministic suite engine — pure ESM, zero dependencies.
// Every artifact is built ONLY from the input text: quotes are exact sentences,
// summaries are extractive, titles come from the sermon's own themes. Nothing is
// invented. This module is the keyless fallback AND the validator baseline for the
// GLM-enhanced path (glm.js).

const STOP = new Set(
  ("the a an and or but if then than that this these those of to in on for with as is are was were be been being it its his her their our your you we they he she i not no so at by from into about after before during under over between out up down here there what which who whom when where why how all any both each few more most other some such only own same too very can will just don should now lord god jesus christ church people us may one also let said says say unto because therefore notice remember imagine every week thing things something really actually very there's it's we're you're they're don't can't won't ours yours theirs " +
    // sermon meta-language: words about the talk, not the message
    "story sermon message passage chapter verse verses bible bibles text today tonight morning room want know like come going still never always someone everyone anybody nobody something another without within maybe perhaps those these").split(" ")
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

// Rank sentences by theme coverage; boost rhetorical markers (application,
// cause, invitation — the sentences a guide should anchor on).
export function rankedSentences(sents, themeWords) {
  const tset = new Set(themeWords);
  return sents
    .map((s, i) => {
      const ws = words(s);
      let score = 0;
      for (const w of ws) if (tset.has(w)) score += 1;
      score /= Math.sqrt(ws.length);
      if (/\b(because|therefore|remember|question|ask yourself|imagine|notice|means|choose|this week)\b/i.test(s)) score *= 1.3;
      return { s, i, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function analyzeSermon(rawText) {
  const text = normalizeWs(rawText); // single whitespace-normalized source of truth
  const all = sentences(text);
  // The first sentences are usually liturgy (greeting, "open your Bibles"),
  // not the message — keep them for the manuscript, exclude from quotes.
  const sents = all.slice(2);
  const th = themes(text, 10).filter((t) => t.length >= 5);
  const ranked = rankedSentences(sents, th);
  // Key quotes: top-scored, returned in sermon order, deduped.
  const keyQuotes = ranked.slice(0, 12).sort((a, b) => a.i - b.i).map((r) => r.s);
  // Movements: split the sermon into 3–5 contiguous chunks; label each with its
  // own dominant theme (honest labels — the theme IS what that chunk is about).
  const movementCount = Math.max(3, Math.min(5, Math.round(all.length / 8)));
  const per = Math.ceil(all.length / movementCount);
  const movements = [];
  const usedLabels = new Set();
  for (let m = 0; m < movementCount; m++) {
    const chunk = all.slice(m * per, (m + 1) * per);
    if (!chunk.length) continue;
    const localThemes = themes(chunk.join(" "), 3).filter((t) => t.length >= 5);
    let label = localThemes[0] || th[m] || "the message";
    if (usedLabels.has(label) && localThemes[1]) label = localThemes[1];
    usedLabels.add(label);
    movements.push({
      label: m === 0
        ? `Opening: ${titleCase(label)}`
        : titleCase(label),
      sents: chunk,
    });
  }
  return { sents, all, themes: th, keyQuotes, movements, wordCount: words(text).length };
}

export function buildManuscript(rawText, a) {
  const title = `${titleCase(a.themes[0] || "Sermon")} — ${titleCase(a.themes[1] || "a message")}`;
  const sections = a.movements.map((m) => ({
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

export function buildDiscussionGuide(a) {
  const [t1, t2, t3] = [a.themes[0] || "the message", a.themes[1] || "this week", a.themes[2] || "the passage"];
  const open = [
    `Where do you see ${t1} showing up in your everyday life — not at church, but Monday to Saturday?`,
    `The sermon pressed into ${t2}. What about that challenged or comforted you most?`,
    `If ${t3} became real in your household this week, what would change first?`,
  ];
  const followUps = [
    "What stands out to you in that moment of the message, and why?",
    "Do you agree? What would you add or push back on?",
    "How have you seen this be true — or struggle to be true — in your own walk?",
  ];
  const qs = a.keyQuotes.slice(0, 6).map((q, i) => ({ quote: q, follow: followUps[i % followUps.length] }));
  return {
    title: `Discussion Guide — ${titleCase(t1)}${t2 ? " & " + titleCase(t2) : ""}`,
    icebreaker: `When you hear the word "${t1}", what picture comes to mind first? Share it with the group.`,
    open,
    qs,
    living: [
      `What is one concrete step you can take this week in response to ${t1}?`,
      `Who in your life needs to hear what you heard in this sermon — and how will you share it with them?`,
    ],
    prayer: `Close by praying together: thank God for His word, ask for help to live out ${t1} this week, and pray for one person each of you named tonight.`,
  };
}

// 5-day devotional: each day anchored on an exact quote, reflection built from
// adjacent real sentences, one action, one prayer line. No scripture references
// are cited (the engine cannot verify chapter/verse from text alone).
export function buildDevotionals(a) {
  const dayActions = [
    (t) => `Write down one situation this week where you will need ${t}, and pray over it once today.`,
    (t) => `Tell one trusted person what God has been teaching you about ${t}.`,
    (t) =>DoOneStep(t),
    (t) => `Do one small act of service today that nobody will notice — practice ${t} in secret.`,
    (t) => `Look back on the week: note one moment God gave you the strength to choose ${t}. Thank Him for it.`,
  ];
  const anchors = a.keyQuotes.slice(0, 5);
  while (anchors.length < 5 && a.sents.length) anchors.push(a.sents[anchors.length % a.sents.length]);
  return anchors.map((quote, i) => {
    const idx = a.sents.indexOf(quote);
    const refl = a.sents.slice(Math.max(0, idx - 1), Math.max(0, idx - 1) + 3).join(" ") || quote;
    const theme = a.themes[i % a.themes.length] || "the message";
    return {
      day: i + 1,
      title: `Day ${i + 1}: ${titleCase(theme)}`,
      anchor: quote,
      reflection: refl,
      action: dayActions[i](theme),
      prayer: `Lord, help me live out ${theme} today. Amen.`,
    };
  });
}

function DoOneStep(t) {
  return `Name one person you have struggled to extend ${t} to — take one small step toward them today.`;
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
    text: `Sunday's message in one line:\n\n“${q}”\n\nFull sermon + discussion guide on our church page. ${tags.join(" ")}`,
  }));
  const xPosts = pullQuotes.map((q) => {
    let text = `“${q}” ${tags.slice(0, 2).join(" ")}`;
    if (text.length > 280) text = `“${q.slice(0, 250)}…” ${tags[0] || ""}`;
    return { platform: "x", text: text.trim().slice(0, 280) };
  });
  return { pullQuotes, captions, xPosts, tags };
}

export function buildSummary(a) {
  // Extractive ~150-word summary: top-ranked sentences, sermon order.
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
    `${t[0]} and ${t[1] || "Grace"}`,
    `The ${t[0]} We Keep Avoiding`,
    `${t[0]} for Ordinary Weeks`,
    `${t[2] || t[1] || "Grace"} Changes Everything`,
    `The ${t[0]} We Almost Missed`,
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
  const a = analyzeSermon(rawText);
  a.ranked = rankedSentences(a.sents, a.themes);
  const text = normalizeWs(rawText);
  return {
    engine: "offline",
    generatedAt: new Date().toISOString(),
    stats: { words: a.wordCount, sentences: a.sents.length, themes: a.themes.slice(0, 5) },
    titles: buildTitles(a),
    summary: buildSummary(a),
    manuscript: buildManuscript(text, a),
    discussionGuide: buildDiscussionGuide(a),
    devotionals: buildDevotionals(a),
    social: buildSocialPack(a),
  };
}
