"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

// §5.3: tabs are underline style (mockup .tabs/.tab). "segmented" keeps the
// shadcn pill look for dense spots.
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground group-data-horizontal/tabs:h-fit group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        line: "gap-5 border-b border-border bg-transparent",
        segmented: "gap-1 rounded-lg bg-muted p-[3px]",
      },
    },
    defaultVariants: {
      variant: "line",
    },
  }
)

function TabsList({
  className,
  variant = "line",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group-data-[variant=line]/tabs-list:relative group-data-[variant=line]/tabs-list:-mb-px group-data-[variant=line]/tabs-list:inline-flex group-data-[variant=line]/tabs-list:h-auto group-data-[variant=line]/tabs-list:flex-none group-data-[variant=line]/tabs-list:items-center group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:pb-2.5 group-data-[variant=line]/tabs-list:pt-0 group-data-[variant=line]/tabs-list:font-medium group-data-[variant=line]/tabs-list:text-faint group-data-[variant=line]/tabs-list:hover:text-foreground group-data-[variant=line]/tabs-list:whitespace-nowrap group-data-[variant=line]/tabs-list:data-active:border-accent group-data-[variant=line]/tabs-list:data-active:text-foreground",
        "group-data-[variant=segmented]/tabs-list:relative group-data-[variant=segmented]/tabs-list:inline-flex group-data-[variant=segmented]/tabs-list:h-[calc(100%-1px)] group-data-[variant=segmented]/tabs-list:flex-1 group-data-[variant=segmented]/tabs-list:items-center group-data-[variant=segmented]/tabs-list:justify-center group-data-[variant=segmented]/tabs-list:gap-1.5 group-data-[variant=segmented]/tabs-list:rounded-md group-data-[variant=segmented]/tabs-list:border group-data-[variant=segmented]/tabs-list:border-transparent group-data-[variant=segmented]/tabs-list:px-1.5 group-data-[variant=segmented]/tabs-list:py-0.5 group-data-[variant=segmented]/tabs-list:text-sm group-data-[variant=segmented]/tabs-list:font-medium group-data-[variant=segmented]/tabs-list:whitespace-nowrap group-data-[variant=segmented]/tabs-list:hover:text-foreground group-data-[variant=segmented]/tabs-list:data-active:bg-background group-data-[variant=segmented]/tabs-list:data-active:text-foreground",
        "inline-flex items-center gap-1.5 px-0 text-sm outline-none transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
