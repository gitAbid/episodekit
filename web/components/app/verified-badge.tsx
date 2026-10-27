import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// §5.3 VerifiedBadge: success-soft fill, check icon, `Verified · 23:41`
// (§6 badges: `Verified · {mm:ss}` / `Verified in transcript`).
export function VerifiedBadge({
  time,
  label,
  className,
}: {
  /** Timestamp shown as `Verified · {time}` (mm:ss from the transcript). */
  time?: string
  /** Full label override, e.g. "Verified in transcript". */
  label?: string
  className?: string
}) {
  const text = label ?? (time ? `Verified · ${time}` : "Verified")
  return (
    <span
      data-slot="verified-badge"
      className={cn(
        "inline-flex h-5 w-fit items-center gap-1 rounded-full bg-success-soft px-2 text-xs font-medium leading-[18px] text-success",
        className
      )}
    >
      <CheckIcon aria-hidden="true" className="size-3" />
      {text}
    </span>
  )
}
