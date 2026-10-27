// U17 — URL parity: every URL in the legacy site/sitemap.xml must exist at the
// same path in the new app router. The fixture is a copy of
// site/sitemap.xml@a458802 (site/ moves to legacy/ at WP-10; web/ stays
// self-contained). The test fails CI when a legacy page loses its route.
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGACY_PUBLIC_PATHS, NEW_PUBLIC_PATHS, pageFileForPath } from "@/lib/marketing/routes";

function parseSitemapPaths(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => new URL(m[1]).pathname.replace(/\.html$/, ""))
    .map((p) => (p !== "/" && p.endsWith("/") ? p.slice(0, -1) : p));
}

describe("U17 legacy URL parity", () => {
  const xml = readFileSync(new URL("../fixtures/legacy-sitemap.xml", import.meta.url), "utf8");
  const sitemapPaths = parseSitemapPaths(xml);

  it("fixture parses to the expected legacy path list", () => {
    expect(sitemapPaths).toHaveLength(12);
    expect(sitemapPaths).toEqual(LEGACY_PUBLIC_PATHS as unknown as string[]);
  });

  it.each(sitemapPaths)("legacy path %s maps to an existing page file", (path) => {
    const file = pageFileForPath(path);
    expect(file, `no route mapping for ${path}`).not.toBeNull();
    expect(existsSync(new URL(`../../${file}`, import.meta.url)), `missing page file for ${path}`).toBe(true);
  });

  it("§5.4 new public routes also exist", () => {
    for (const path of NEW_PUBLIC_PATHS) {
      const file = pageFileForPath(path);
      expect(file, `no route mapping for ${path}`).not.toBeNull();
      expect(existsSync(new URL(`../../${file}`, import.meta.url))).toBe(true);
    }
  });
});
