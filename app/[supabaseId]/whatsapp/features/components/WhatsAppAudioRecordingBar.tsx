"use client"

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
}

export function WhatsAppAudioRecordingBar({
  status,
  elapsedMs,
  waveformLevels,
  onCancel,
  onPause,
  onResume,
}: WhatsAppAudioRecordingBarProps) {
  const playheadIndex = Math.max(0, waveformLevels.length - 1)
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5">
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

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
        <span className="min-w-[2.25rem] text-xs tabular-nums text-foreground">
          {formatDurationMs(elapsedMs)}
        </span>
      </div>

      {prefersReducedMotion ? (
        <p className="flex-1 text-xs text-muted-foreground">Gravando áudio</p>
      ) : (
        <div
          className="flex h-8 min-w-0 flex-1 items-center gap-0.5 overflow-hidden"
          aria-hidden
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
