"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  FileTextIcon,
  ListIcon,
  NewspaperIcon,
  Share2Icon,
  SignatureIcon,
  MessageSquareQuoteIcon,
  StickyNoteIcon,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

import { StatusPill } from "@/components/app/status-pill"
import { VerifiedBadge } from "@/components/app/verified-badge"
import { QuoteBlock } from "@/components/app/quote-block"
import { ArtifactNavItem } from "@/components/app/artifact-nav-item"
import { AudioMini } from "@/components/app/audio-mini"
import { DropZone } from "@/components/app/dropzone"
import { QuotaMeter } from "@/components/app/quota-meter"
import { CharCounter } from "@/components/app/char-counter"
import { FeedbackThumbs } from "@/components/app/feedback-thumbs"

// Sample content comes from docs/samples/demo-episode.txt only (spec rule:
// never invent testimonials or quotes).
const DEMO_QUOTE =
  "We budget our dollars, we calendar our hours, and then we let anyone with a notification spend our attention for free."

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2>{title}</h2>
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
        {children}
      </div>
    </section>
  )
}

function Row({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
}

export function ComponentShowcase() {
  const [slider, setSlider] = React.useState([60])
  const [switchOn, setSwitchOn] = React.useState(true)
  const [checked, setChecked] = React.useState(true)
  const [bio, setBio] = React.useState("Focus is the most expensive resource in modern work.")

  const navItems: Array<{ icon: LucideIcon; label: string; ready: boolean }> = [
    { icon: StickyNoteIcon, label: "Show notes", ready: true },
    { icon: ListIcon, label: "Chapters", ready: true },
    { icon: FileTextIcon, label: "Summary", ready: true },
    { icon: SignatureIcon, label: "Titles", ready: false },
    { icon: NewspaperIcon, label: "Blog post", ready: false },
    { icon: MessageSquareQuoteIcon, label: "Quotes", ready: false },
    { icon: Share2Icon, label: "Social", ready: false },
  ]

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-micro text-faint">DEV ONLY — unlinked, noindex</p>
        <h1>Components</h1>
        <p className="text-body">
          Every §5.3 component in light and dark. Sample text is from
          docs/samples/demo-episode.txt.
        </p>
      </header>

      <Section title="Button">
        <Row>
          <Button>Start free</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </Row>
        <Row>
          <Button size="sm">Small 32</Button>
          <Button size="default">Default 40</Button>
          <Button size="lg">Large 48</Button>
        </Row>
      </Section>

      <Section title="Input · Textarea · Select">
        <Row>
          <label htmlFor="demo-episode-title" className="sr-only">
            Episode title
          </label>
          <Input
            id="demo-episode-title"
            placeholder="Episode title (optional)"
            className="w-64"
          />
          <Select defaultValue="mp3">
            <SelectTrigger aria-label="Audio format" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mp3">MP3</SelectItem>
              <SelectItem value="m4a">M4A</SelectItem>
              <SelectItem value="wav">WAV</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="demo-transcript" className="text-small font-medium text-foreground">
            Paste transcript
          </label>
          <Textarea
            id="demo-transcript"
            value={bio}
            maxLength={200}
            onChange={(e) => setBio(e.target.value)}
          />
          <CharCounter value={bio.length} max={200} />
        </div>
      </Section>

      <Section title="Slider · Switch · Checkbox">
        <Row className="w-full">
          <label className="text-small text-body">Formality</label>
          <Slider
            id="demo-formality"
            value={slider}
            onValueChange={setSlider}
            min={0}
            max={100}
            step={1}
            ariaLabel="Formality"
          />
        </Row>
        <Row>
          <Switch
            checked={switchOn}
            onCheckedChange={setSwitchOn}
            aria-label="Ready"
          />
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
            aria-label="Ready"
          />
        </Row>
      </Section>

      <Section title="Tabs (underline)">
        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">Upload audio</TabsTrigger>
            <TabsTrigger value="transcript">Paste transcript</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="text-small text-body">
            Drop an audio or video file to transcribe.
          </TabsContent>
          <TabsContent value="transcript" className="text-small text-body">
            Paste an existing transcript instead.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Badge">
        <Row>
          <Badge>Accent</Badge>
          <Badge variant="secondary">Neutral</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Danger</Badge>
          <Badge variant="outline">Outline</Badge>
        </Row>
      </Section>

      <Section title="Toast">
        <Row>
          <Button
            variant="secondary"
            onClick={() => toast("Copied")}
          >
            Show toast
          </Button>
          <p className="text-small text-faint">Bottom-right, 4 s.</p>
        </Row>
      </Section>

      <Section title="Dialog · Sheet · Popover · DropdownMenu · Tooltip">
        <Row>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel Pro?</DialogTitle>
                <DialogDescription>
                  You&rsquo;ll keep Pro until Nov 30. Your episodes stay.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary">Keep Pro</Button>
                <Button variant="destructive">Cancel plan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">Open sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Quote check</SheetTitle>
                <SheetDescription>
                  Every quote is checked against the audio.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent aria-label="Quote details">
              <VerifiedBadge time="01:12" />
              <p className="text-small text-body">
                Exact words from the audio, checked at 01:12.
              </p>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Regenerate</DropdownMenuLabel>
              <DropdownMenuItem>Shorter</DropdownMenuItem>
              <DropdownMenuItem>Punchier</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Remove</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" aria-label="Download all">
                <span aria-hidden="true">?</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download all artifacts</TooltipContent>
          </Tooltip>
        </Row>
      </Section>

      <Section title="Progress · Skeleton">
        <Row className="w-full">
          <Progress value={64} aria-label="Compressing" className="max-w-64" />
          <span className="font-mono text-xs tabular-nums text-faint">64%</span>
        </Row>
        <Row className="w-full">
          <Skeleton className="h-2.5 w-full" />
        </Row>
        <Row className="w-full">
          <Skeleton className="h-2.5 w-2/3" />
        </Row>
      </Section>

      <Section title="StatusPill">
        <Row>
          <StatusPill status="queued" />
          <StatusPill status="transcribing" />
          <StatusPill status="writing" />
          <StatusPill status="ready" />
          <StatusPill status="failed" />
        </Row>
      </Section>

      <Section title="VerifiedBadge">
        <Row>
          <VerifiedBadge time="23:41" />
          <VerifiedBadge label="Verified in transcript" />
        </Row>
      </Section>

      <Section title="QuoteBlock">
        <QuoteBlock
          quote={DEMO_QUOTE}
          verifiedTime="01:12"
          onSwap={() => toast("Swapped")}
          onRemove={() => toast("Removed")}
        />
        <QuoteBlock quote={DEMO_QUOTE} />
      </Section>

      <Section title="ArtifactNavItem">
        <nav aria-label="Artifacts" className="flex w-55 flex-col gap-0.5">
          {navItems.map((item) => (
            <ArtifactNavItem
              key={item.label}
              href="#"
              icon={item.icon}
              label={item.label}
              ready={item.ready}
              active={item.label === "Show notes"}
            />
          ))}
        </nav>
      </Section>

      <Section title="AudioMini">
        <AudioMini duration={3492} />
        <p className="text-small text-faint">
          Demo mode (no src): play/pause and speed simulate progress.
        </p>
      </Section>

      <Section title="DropZone">
        <DropZone
          accept="audio/*,video/*"
          title="Drop audio or video, or browse"
          hint="MP3, M4A, WAV, MP4, MOV · up to 2 hours"
          onFiles={(files) => toast(`Added ${files[0]?.name ?? "file"}`)}
        />
      </Section>

      <Section title="QuotaMeter · CharCounter">
        <QuotaMeter used={3} limit={10} resetsOn="Nov 14" />
        <Row>
          <CharCounter value={1284} max={4000} />
          <CharCounter value={3741} max={4000} />
          <CharCounter value={4117} max={4000} />
        </Row>
      </Section>

      <Section title="FeedbackThumbs">
        <Row>
          <FeedbackThumbs onFeedback={(v) => toast(v === "up" ? "Thanks" : "Noted")} />
          <p className="text-small text-faint">One per artifact; note lands in WP-09.</p>
        </Row>
      </Section>
    </main>
  )
}
