import { cn } from "@/lib/utils"

// §5.3 CharCounter: warning at >=90%, danger past 100% (mockup .counter).
export function CharCounter({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const ratio = max > 0 ? value / max : 0
  const over = ratio > 1
  const warn = !over && ratio >= 0.9
  return (
    <span
      data-slot="char-counter"
      aria-live="polite"
      className={cn(
        "font-mono text-xs tabular-nums",
        over ? "text-danger" : warn ? "text-warning" : "text-faint",
        className
      )}
    >
      {value.toLocaleString("en-US")}/{max.toLocaleString("en-US")}
    </span>
  )
}
