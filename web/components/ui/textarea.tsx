import * as React from "react"
import { cn } from "cn"

// §5.3/mockup: min-height 120px, resizable, border-strong.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-30 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-[22px] transition-colors outline-none field-sizing-content placeholder:text-faint disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
