import Link from "next/link";

// MK-1 top bar: logo · Tools · Pricing · Samples · Sign in · Start free.
export function MarketingNav() {
  return (
    <header className="border-b border-border">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4"
      >
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Episode<span className="text-accent">Kit</span>
        </Link>
        <div className="hidden items-center gap-5 text-sm font-medium text-body sm:flex">
          <Link href="/tools" className="hover:text-foreground">
            Tools
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/samples" className="hover:text-foreground">
            Samples
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/sign-in" className="hidden text-sm font-medium text-body hover:text-foreground sm:inline">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-8 items-center rounded-md border border-accent bg-accent px-3 text-[13px] font-medium text-on-accent hover:bg-accent-hover"
          >
            Start free
          </Link>
        </div>
      </nav>
    </header>
  );
}
