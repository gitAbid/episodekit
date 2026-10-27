"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { VerifiedBadge } from "@/components/app/verified-badge"

// §5.3 QuoteBlock: 3px accent left border, quote text, attribution
// (`— Maya` or `— from the episode`), verified badge, Remove/Swap.
export function QuoteBlock({
  quote,
  attribution,
  verifiedTime,
  onRemove,
  onSwap,
  className,
}: {
  quote: string
  /** Speaker name; omit for the §6 default "— from the episode". */
  attribution?: string
  /** mm:ss timestamp; renders the VerifiedBadge when present. */
  verifiedTime?: string
  onRemove?: () => void
  onSwap?: () => void
  className?: string
}) {
  return (
    <figure
      data-slot="quote-block"
      className={cn(
        "flex flex-col gap-2 border-l-[3px] border-accent py-1 pl-3.5",
        className
      )}
    >
      <blockquote className="text-[15px] leading-6 text-foreground">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className="flex flex-wrap items-center gap-2 text-small text-faint">
        {verifiedTime ? (
          <VerifiedBadge time={verifiedTime} />
        ) : (
          <VerifiedBadge label="Verified in transcript" />
        )}
        <span>&mdash; {attribution ?? "from the episode"}</span>
        {(onSwap || onRemove) && (
          <span className="ml-auto flex items-center gap-1">
            {onSwap && (
              <Button variant="ghost" size="xs" onClick={onSwap}>
                Swap
              </Button>
            )}
            {onRemove && (
              <Button variant="ghost" size="xs" onClick={onRemove}>
                Remove
              </Button>
            )}
          </span>
        )}
      </figcaption>
    </figure>
  )
}
