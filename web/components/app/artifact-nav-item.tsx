import Link from "next/link"
import { CheckIcon, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// §5.3 ArtifactNavItem: icon, name, ✓ if Ready (workspace left nav, 220px).
export function ArtifactNavItem({
  href,
  icon: Icon,
  label,
  ready = false,
  active = false,
  className,
}: {
  href: string
  icon: LucideIcon
  label: string
  ready?: boolean
  active?: boolean
  className?: string
}) {
  return (
    <Link
      href={href}
      data-slot="artifact-nav-item"
      data-ready={ready}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors outline-none",
        active
          ? "bg-accent-soft text-accent"
          : "text-body hover:bg-surface-2 hover:text-foreground",
        className
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {ready && (
        <>
          <CheckIcon aria-hidden="true" className="size-3.5 shrink-0 text-success" />
          <span className="sr-only">Ready</span>
        </>
      )}
    </Link>
  )
}
