import { Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"

export type ArtifactStatus =
  | "queued"
  | "transcribing"
  | "writing"
  | "ready"
  | "failed"

const LABELS: Record<ArtifactStatus, string> = {
  queued: "Queued",
  transcribing: "Transcribing",
  writing: "Writing",
  ready: "Ready",
  failed: "Failed",
}

// §5.3 StatusPill: Queued faint · Transcribing/Writing accent + spinner ·
// Ready success · Failed danger (mockup .pill).
const STATUS_STYLES: Record<ArtifactStatus, string> = {
  queued: "border-border bg-surface text-faint",
  transcribing: "border-transparent bg-accent-soft text-accent",
  writing: "border-transparent bg-accent-soft text-accent",
  ready: "border-transparent bg-success-soft text-success",
  failed: "border-transparent bg-danger-soft text-danger",
}

export function StatusPill({
  status,
  label,
  className,
}: {
  status: ArtifactStatus
  /** Overrides the default §6 copy-deck label for the status. */
  label?: string
  className?: string
}) {
  const busy = status === "transcribing" || status === "writing"
  return (
    <span
      data-slot="status-pill"
      data-status={status}
      className={cn(
        "inline-flex h-6 w-fit items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status],
        className
      )}
    >
      {busy ? (
        <Loader2Icon
          aria-hidden="true"
          className="size-2.5 animate-spin motion-reduce:animate-none"
        />
      ) : (
        <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      )}
      {label ?? LABELS[status]}
    </span>
  )
}
