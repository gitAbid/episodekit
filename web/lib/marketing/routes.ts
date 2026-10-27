// U17 URL parity — the single source of truth for public marketing routes that
// must keep their legacy paths. The list is ported from `site/sitemap.xml`
// (copied to tests/fixtures/legacy-sitemap.xml; site/ moves to legacy/ at
// WP-10). The parity unit test asserts every sitemap URL maps to a real page
// file in the app router, so a removed page fails CI instead of a visitor.
import { TOOL_IDS } from "@/lib/tools/defs";

export const COMPARE_SLUGS = ["podsqueeze", "castmagic"] as const;

export const TOOL_PATHS = [
  "/tools",
  "/tools/show-notes",
  "/tools/episode-titles",
  "/tools/email-series",
  "/tools/discussion-guide",
] as const;

/** Every path from the legacy sitemap (minus the origin). */
export const LEGACY_PUBLIC_PATHS: readonly string[] = [
  "/",
  "/samples",
  "/tools",
  "/tools/show-notes",
  "/tools/discussion-guide",
  "/compare/podsqueeze",
  "/compare/castmagic",
  "/templates/show-notes",
  "/guides/show-notes",
  "/guides/repurposing",
  "/tools/episode-titles",
  "/tools/email-series",
];

/** New routes that were not in the legacy sitemap (§5.4 public route list). */
export const NEW_PUBLIC_PATHS: readonly string[] = ["/pricing", "/privacy", "/terms"];

/**
 * Resolve a public path to its page file under app/(marketing), or null.
 * Dynamic segments are resolved from the explicit slug lists above so the
 * test checks concrete URLs, not folder names.
 */
export function pageFileForPath(path: string): string | null {
  if (path === "/") return "app/(marketing)/page.tsx";
  if (path.startsWith("/compare/")) {
    const slug = path.slice("/compare/".length);
    return (COMPARE_SLUGS as readonly string[]).includes(slug)
      ? "app/(marketing)/compare/[slug]/page.tsx"
      : null;
  }
  // the four free tools live behind one dynamic segment (generateStaticParams)
  if (path.startsWith("/tools/")) {
    const id = path.slice("/tools/".length);
    return (TOOL_IDS as readonly string[]).includes(id)
      ? "app/(marketing)/tools/[tool]/page.tsx"
      : null;
  }
  return `app/(marketing)${path}/page.tsx`;
}
