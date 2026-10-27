import { cn } from "cn"

// Mockup .skel: flat surface-3 block (no pulse — §5.1 "flat & calm").
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-sm bg-surface-3", className)}
      {...props}
    />
  )
}

export { Skeleton }
