"use client"

import * as React from "react"
import { PauseIcon, PlayIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const SPEEDS = [1, 1.5, 2] as const

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

// §5.3 AudioMini: play/pause, time, speed 1/1.5/2. With `src` it plays real
// audio; without one it simulates progress so layouts can be previewed.
export function AudioMini({
  src,
  duration = 0,
  className,
}: {
  src?: string
  /** Total length in seconds (fallback when `src` has no metadata yet). */
  duration?: number
  className?: string
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const currentRef = React.useRef(0)
  const [playing, setPlaying] = React.useState(false)
  const [current, setCurrent] = React.useState(0)
  const [total, setTotal] = React.useState(duration)
  const [speedIndex, setSpeedIndex] = React.useState(0)

  const seek = (t: number) => {
    currentRef.current = t
    setCurrent(t)
  }

  React.useEffect(() => {
    const audio = audioRef.current
    if (!src || !audio) return
    const onTime = () => seek(audio.currentTime)
    const onMeta = () => setTotal(audio.duration || duration)
    const onEnd = () => setPlaying(false)
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("loadedmetadata", onMeta)
    audio.addEventListener("ended", onEnd)
    return () => {
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("loadedmetadata", onMeta)
      audio.removeEventListener("ended", onEnd)
    }
  }, [src, duration])

  // Demo tick when no src is wired up yet (showcase/placeholder layouts).
  React.useEffect(() => {
    if (src || !playing || total <= 0) return
    const step = 0.25 * SPEEDS[speedIndex]
    const id = window.setInterval(() => {
      const next = Math.min(currentRef.current + step, total)
      seek(next)
      if (next >= total) {
        window.clearInterval(id)
        setPlaying(false)
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [src, playing, total, speedIndex])

  const toggle = () => {
    const audio = audioRef.current
    if (audio) {
      if (playing) audio.pause()
      else void audio.play()
    } else if (currentRef.current >= total) {
      seek(0) // restart the demo when it reached the end
    }
    setPlaying((p) => !p)
  }

  const cycleSpeed = () => {
    const next = (speedIndex + 1) % SPEEDS.length
    setSpeedIndex(next)
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next]
  }

  const speed = SPEEDS[speedIndex]

  return (
    <div
      data-slot="audio-mini"
      className={cn(
        "flex h-10 w-fit items-center gap-1.5 rounded-md border border-border bg-surface px-1.5",
        className
      )}
    >
      {src && <audio ref={audioRef} src={src} preload="metadata" className="hidden" />}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
      </Button>
      <span className="font-mono text-[13px] tabular-nums text-body">
        {formatTime(current)} / {formatTime(total)}
      </span>
      <Button
        variant="ghost"
        size="xs"
        onClick={cycleSpeed}
        aria-label={`Playback speed ${speed}x`}
        className="font-mono tabular-nums"
      >
        {speed}x
      </Button>
    </div>
  )
}
