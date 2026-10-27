import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

// §5.3 QuotaMeter; MK-3: bar + "3 of 10 · resets Nov 14".
export function QuotaMeter({
  used,
  limit,
  resetsOn,
  label = "Episode quota",
  className,
}: {
  used: number
  limit: number
  /** §6 wall copy reset date, shown as `· resets {resetsOn}`. */
  resetsOn?: string
  /** Accessible name for the progress bar. */
  label?: string
  className?: string
}) {
  const value = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  return (
    <div
      data-slot="quota-meter"
      className={cn("flex w-full max-w-56 flex-col gap-1.5", className)}
    >
      <Progress value={value} aria-label={label} />
      <p className="font-mono text-xs tabular-nums text-faint">
        {used} of {limit}
        {resetsOn ? ` · resets ${resetsOn}` : ""}
      </p>
    </div>
  )
}
