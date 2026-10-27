// §8.4 post-checks for every AI artifact, as pure functions:
//  - limits/counts trim at sentence boundary
//  - neverSay word-boundary scan
//  - strip URLs not in show settings
//  - religion-neutral gate on GENERATED framing only — never on transcript
//    quotes (a transcript that says "church" is content; regenerated framing
//    that says "sermon" is a voice violation). Callers must respect that split.
import { normalizeWs } from "@/lib/engine";

// ---- religion-neutral gate (term list from engine/test.js) -----------------

export const RELIGION_TERMS = [
  "sermon",
  "church",
  "devotional",
  "prayer",
  "jesus",
  "god",
  "pastor",
] as const;

// Same semantics as the legacy test gate: /sermon|church|devotional|prayer|jesus|god\b|pastor/
// (`god` only with a trailing word boundary — "godly" passes).
export function religionViolations(text: string): string[] {
  const out: string[] = [];
  const re = /sermon|church|devotional|prayer|jesus|god\b|pastor/gi;
  for (const m of text.matchAll(re)) out.push(m[0].toLowerCase());
  return out;
}

export function isReligionNeutral(text: string): boolean {
  return religionViolations(text).length === 0;
}

// ---- neverSay word-boundary scan -------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Multi-word terms match across whitespace variance; edges are word boundaries
// ("delve" flags "we delve", not "delving").
export function neverSayViolations(text: string, neverSay: readonly string[]): string[] {
  const out: string[] = [];
  for (const term of neverSay) {
    const pattern = term.trim().split(/\s+/).map(escapeRegex).join("\\s+");
    if (new RegExp(`(?<!\\w)${pattern}(?!\\w)`, "i").test(text)) out.push(term);
  }
  return out;
}

// ---- foreign URLs -----------------------------------------------------------

const URL_RE = /https?:\/\/[^\s<>")\]}]+/gi;

// Remove URLs that are not in the show's allow list (anti-hallucinated links).
// Trailing sentence punctuation is preserved.
export function stripForeignUrls(text: string, allowedUrls: readonly string[]): string {
  const allowed = new Set(allowedUrls);
  const out = text.replace(URL_RE, (url) => {
    const core = url.replace(/[.,;:!?)]+$/, "");
    const trailing = url.slice(core.length); // sentence punctuation stays
    return allowed.has(core) ? core + trailing : trailing;
  });
  return out
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// ---- limits / counts --------------------------------------------------------

export function wordCount(text: string): number {
  const t = normalizeWs(text);
  return t ? t.split(" ").length : 0;
}

// Trim to ≤ maxChars at the last sentence boundary; fall back to a word
// boundary; never mid-word. Used when an artifact is only slightly over its
// §7.2 limits (badly-off artifacts regenerate instead, §8.4).
export function trimAtSentenceBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, maxChars);
  for (let i = head.length - 1; i >= 0; i--) {
    if (/[.!?]/.test(head[i]) && (i + 1 === head.length || /\s/.test(head[i + 1]))) {
      return text.slice(0, i + 1);
    }
  }
  const sp = head.lastIndexOf(" ");
  return sp > 0 ? text.slice(0, sp) : head;
}
