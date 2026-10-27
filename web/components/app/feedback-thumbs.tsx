"use client"

import * as React from "react"
import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// §5.3 FeedbackThumbs: 👍/👎 per artifact (§0.2 analytics); the note field
// and API wiring land with WP-09.
export function FeedbackThumbs({
  onFeedback,
  className,
}: {
  onFeedback?: (value: "up" | "down") => void
  className?: string
}) {
  const [choice, setChoice] = React.useState<"up" | "down" | null>(null)

  const select = (value: "up" | "down") => {
    setChoice((c) => (c === value ? null : value))
    onFeedback?.(value)
  }

  return (
    <div
      data-slot="feedback-thumbs"
      role="group"
      aria-label="Rate this artifact"
      className={cn("flex items-center gap-1", className)}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-pressed={choice === "up"}
        aria-label="Helpful"
        onClick={() => select("up")}
        className={
          choice === "up" ? "bg-accent-soft text-accent" : "text-faint hover:text-foreground"
        }
      >
        <ThumbsUpIcon aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-pressed={choice === "down"}
        aria-label="Not helpful"
        onClick={() => select("down")}
        className={
          choice === "down" ? "bg-accent-soft text-accent" : "text-faint hover:text-foreground"
        }
      >
        <ThumbsDownIcon aria-hidden="true" />
      </Button>
    </div>
  )
}
