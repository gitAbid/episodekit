import type { Metadata } from "next";
import { ComponentShowcase } from "@/components/app/component-showcase";

// Dev-only component gallery (WP-01). Ships in every build so `pnpm e2e`
// (production build via `next start`) can axe-scan it, but it is unlinked
// from all navigation and marked noindex — see DECISIONS.md 2026-10-27.
export const metadata: Metadata = {
  title: "Components (dev)",
  robots: { index: false, follow: false },
};

export default function DevComponentsPage() {
  return <ComponentShowcase />;
}
