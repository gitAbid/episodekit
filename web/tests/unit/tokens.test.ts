import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// §5.2 acceptance: token pairs must pass WCAG 2.2 AA (4.5:1 for normal text).
// The hex values are parsed straight out of app/globals.css so the CSS stays
// the single source of truth.

const cssPath = join(import.meta.dirname ?? ".", "..", "..", "app", "globals.css");
const css = readFileSync(cssPath, "utf8");

const DARK_MARKER = "/* §5.2 tokens — dark";
const darkSplit = css.indexOf(DARK_MARKER);
if (darkSplit === -1) throw new Error("globals.css is missing the dark token block");

function tokensFrom(chunk: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [, name, value] of chunk.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    tokens[name] = value;
  }
  return tokens;
}

const light = tokensFrom(css.slice(0, darkSplit));
const dark = tokensFrom(css.slice(darkSplit));

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = hex.replace("#", "");
  return (
    0.2126 * linear(parseInt(n.slice(0, 2), 16)) +
    0.7152 * linear(parseInt(n.slice(2, 4), 16)) +
    0.0722 * linear(parseInt(n.slice(4, 6), 16))
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Pairs the UI actually renders (see DECISIONS.md: muted-foreground maps to
// --body, and --faint is only used on --bg/--surface, never on surface-2/3).
const PAIRS: Array<[string, string]> = [
  ["text", "bg"],
  ["text", "surface"],
  ["text", "surface-2"],
  ["text", "surface-3"],
  ["body", "bg"],
  ["body", "surface"],
  ["body", "surface-2"],
  ["faint", "bg"],
  ["faint", "surface"],
  ["accent", "bg"],
  ["accent", "surface"],
  ["accent", "accent-soft"],
  ["on-accent", "accent"],
  ["success", "success-soft"],
  ["warning", "warning-soft"],
  ["danger", "danger-soft"],
];

describe("§5.2 tokens", () => {
  it.each([
    ["light", light],
    ["dark", dark],
  ])("%s palette defines the full token set", (_mode, tokens) => {
    for (const [fg, bg] of PAIRS) {
      expect(tokens[fg], `--${fg} missing`).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(tokens[bg], `--${bg} missing`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it.each([
    ["light", light],
    ["dark", dark],
  ])("%s text pairs pass WCAG AA (4.5:1)", (_mode, tokens) => {
    for (const [fg, bg] of PAIRS) {
      const ratio = contrast(tokens[fg], tokens[bg]);
      expect(
        ratio,
        `--${fg} on --${bg} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("dark palette differs from light", () => {
    expect(dark["bg"]).not.toBe(light["bg"]);
    expect(dark["accent"]).not.toBe(light["accent"]);
  });
});
