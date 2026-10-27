"use client"

import * as React from "react"
import { UploadIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// §5.3 DropZone: dashed border-strong, 200px, drag-over turns accent-soft.
export function DropZone({
  onFiles,
  accept,
  title = "Drop a file, or browse",
  hint,
  disabled = false,
  className,
}: {
  onFiles?: (files: FileList) => void
  accept?: string
  title?: string
  hint?: string
  disabled?: boolean
  className?: string
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = React.useState(false)

  return (
    <>
      <button
        type="button"
        data-slot="dropzone"
        data-dragging={dragging}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled && e.dataTransfer.files.length > 0) onFiles?.(e.dataTransfer.files)
        }}
        className={cn(
          "flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-6 py-8 text-center transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
          dragging
            ? "border-accent bg-accent-soft"
            : "border-border-strong bg-surface hover:bg-surface-2"
        )}
      >
        <UploadIcon aria-hidden="true" className="mb-1 size-5 text-faint" />
        <span className="text-sm font-medium text-foreground">{title}</span>
        {hint && <span className="text-small text-faint">{hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles?.(e.target.files)
          e.target.value = ""
        }}
      />
    </>
  )
}
