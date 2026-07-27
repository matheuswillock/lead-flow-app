"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDurationMs } from "../utils/formatDuration"
import type { WhatsAppAudioRecorderStatus } from "../hooks/useWhatsAppAudioRecorder"

interface WhatsAppAudioRecordingBarProps {
  status: WhatsAppAudioRecorderStatus
  elapsedMs: number
  waveformLevels: number[]
  onCancel: () => void
  onPause: () => void
  onResume: () => void
  onConfirmSend?: () => void
  previewUrl?: string | null
  onWaveformBarCountChange?: (count: number) => void
}

export function WhatsAppAudioRecordingBar({
  status,
  elapsedMs,
  waveformLevels,
  onCancel,
  onPause,
  onResume,
  previewUrl,
  onWaveformBarCountChange,
}: WhatsAppAudioRecordingBarProps) {
  const playheadIndex = Math.max(0, waveformLevels.length - 1)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const waveHostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setPrefersReducedMotion(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    const host = waveHostRef.current
    if (!host || !onWaveformBarCountChange) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      const barSlot = 3
      const count = Math.max(8, Math.floor(width / barSlot))
      onWaveformBarCountChange(count)
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [onWaveformBarCountChange])

  if (status === "preview") {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          onClick={onCancel}
          aria-label="Descartar áudio"
        >
          <Trash2 />
        </Button>
        {previewUrl ? (
          <audio controls src={previewUrl} className="min-w-0 flex-1" aria-label="Prévia do áudio" />
        ) : (
          <p className="flex-1 text-xs text-muted-foreground">Prévia pronta para enviar</p>
        )}
        <span className="min-w-[2.25rem] text-xs tabular-nums text-foreground">
          {formatDurationMs(elapsedMs)}
        </span>
      </div>
    )
  }

  return (
    <div className="grid min-w-0 flex-1 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 py-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0"
        onClick={onCancel}
        aria-label="Descartar gravação"
      >
        <Trash2 />
      </Button>

      <div className="flex min-w-0 items-center gap-2">
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "size-2 rounded-full bg-destructive",
              !prefersReducedMotion && status === "recording" && "animate-pulse"
            )}
            aria-hidden
          />
          <span className="min-w-[2.25rem] text-xs tabular-nums text-foreground">
            {formatDurationMs(elapsedMs)}
          </span>
        </div>

        {prefersReducedMotion ? (
          <p className="flex-1 text-xs text-muted-foreground" aria-live="polite">
            Gravando áudio
          </p>
        ) : (
          <div
            ref={waveHostRef}
            className="flex h-8 min-w-0 flex-1 items-center gap-0.5 overflow-hidden"
            role="img"
            aria-label="Forma de onda da gravação"
          >
            {waveformLevels.map((level, index) => {
              const isPlayhead = index === playheadIndex
              const heightPx = Math.max(2, Math.round(2 + level * 28))
              return (
                <div
                  key={index}
                  className={cn(
                    "w-0.5 shrink-0 rounded-sm",
                    isPlayhead ? "bg-destructive" : "bg-foreground/70"
                  )}
                  style={{ height: `${heightPx}px` }}
                />
              )
            })}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 text-destructive hover:text-destructive"
        onClick={status === "paused" ? onResume : onPause}
        aria-label={status === "paused" ? "Retomar gravação" : "Pausar gravação"}
      >
        {status === "paused" ? <Play /> : <Pause />}
      </Button>
    </div>
  )
}
