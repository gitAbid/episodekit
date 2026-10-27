// Sitemap — keeps the legacy public URLs (M12/U17) plus the new §5.4 routes.
import type { MetadataRoute } from "next";
import { LEGACY_PUBLIC_PATHS, NEW_PUBLIC_PATHS } from "@/lib/marketing/routes";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://episodekit.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [...LEGACY_PUBLIC_PATHS, ...NEW_PUBLIC_PATHS].map((path) => ({
    url: `${BASE}${path === "/" ? "" : path}`,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.8,
  }));
}
