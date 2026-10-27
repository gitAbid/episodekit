import Link from "next/link";

// MK-1 footer: Tools · Privacy · Terms · "A PeraByte AI product".
export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm">
        <div className="flex items-center gap-4 text-body">
          <Link href="/tools" className="hover:text-foreground">
            Tools
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </div>
        <span className="text-faint">A PeraByte AI product</span>
      </div>
    </footer>
  );
}
