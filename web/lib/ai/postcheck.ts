// §8.4 post-check wiring for AI-generated content (WP-03's pure functions in
// lib/artifacts/postcheck are the primitives; this module applies them to a
// parsed artifact JSON tree).
//
// Safety note (WP-03 decision, kept): scans run on GENERATED framing only.
// Content stores QuoteRefs (offsets), never model quote text, and the model's
// `exact` strings are consumed by quote resolution and discarded — so walking
// the content tree never touches transcript wording.
import {
  isReligionNeutral,
  neverSayViolations,
  religionViolations,
} from "@/lib/artifacts/postcheck";
import type { VoiceProfile } from "./voice";

/** Collect every string in a content tree (objects, arrays, nested). */
export function collectStrings(value: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return out;
}

/** Deep-clone a content tree, mapping every string through `fn`. */
export function mapStrings<T>(value: T, fn: (s: string) => string): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return fn(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, walk(val)]));
    }
    return v;
  };
  return walk(value) as T;
}

export interface ContentViolations {
  neverSay: string[];
  religion: string[];
}

export function scanContent(content: unknown, voice: VoiceProfile): ContentViolations {
  const joined = collectStrings(content).join("\n");
  return {
    neverSay: neverSayViolations(joined, voice.neverSay),
    religion: isReligionNeutral(joined) ? [] : religionViolations(joined),
  };
}

/**
 * Strip URLs that are not in the show's allow list from every string.
 * An allow-list entry also covers its own subpaths ("https://show.example"
 * allows "https://show.example/ep-12") — the admin-listed link is the show's
 * site, and links under it are not hallucinated foreign domains.
 */
export function stripForeignUrlsInContent<T>(content: T, allowedUrls: readonly string[]): T {
  return mapStrings(content, (s) => {
    const stripped = s.replace(URL_RE, (url) => {
      const core = url.replace(/[.,;:!?)]+$/, "");
      const trailing = url.slice(core.length); // sentence punctuation stays
      return isAllowedUrl(core, allowedUrls) ? core + trailing : trailing;
    });
    if (stripped === s) return s;
    return stripped
      .replace(/[ \t]+([.,;:!?])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/^[ \t]+/gm, "")
      .trim();
  });
}

const URL_RE = /https?:\/\/[^\s<>)"\]}]+/gi;

function isAllowedUrl(url: string, allowed: readonly string[]): boolean {
  if (!allowed.length) return false;
  return allowed.some((a) => {
    if (!a) return false;
    if (url === a) return true;
    return url.startsWith(a.endsWith("/") ? a : `${a}/`);
  });
}

/**
 * The full deterministic post-treatment: strip foreign URLs, then replace
 * banned phrases at word boundaries (last resort of the §8.4 flow). Returns
 * the transformed content — callers re-validate with Zod afterwards.
 */
export function applyDeterministicPostChecks<T>(
  content: T,
  voice: VoiceProfile,
  allowedUrls: readonly string[],
): T {
  let out = stripForeignUrlsInContent(content, allowedUrls);
  const remaining = neverSayViolations(collectStrings(out).join("\n"), voice.neverSay);
  if (remaining.length) {
    out = replaceBannedPhrases(out, remaining);
  }
  return out;
}

/**
 * Replace banned phrases (word-boundary, case-insensitive) with "" and clean
 * up the whitespace left behind. Honest last resort after one regenerate with
 * feedback — grammar may suffer; the banned word never ships (U8).
 */
export function replaceBannedPhrases<T>(content: T, terms: readonly string[]): T {
  const pattern = new RegExp(
    terms
      .map((t) => t.trim().split(/\s+/).map(escapeRegex).join("\\s+"))
      .join("|"),
    "gi",
  );
  return mapStrings(content, (s) =>
    s
      .replace(new RegExp(`(?<!\\w)(?:${pattern.source})(?!\\w)`, "gi"), "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+([.,;:!?])/g, "$1")
      .replace(/^[ \t]+/gm, "")
      .trim(),
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
