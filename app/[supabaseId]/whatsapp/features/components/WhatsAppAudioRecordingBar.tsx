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

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
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

      <div
        className="flex h-8 min-w-0 flex-1 items-center gap-px overflow-hidden"
        aria-hidden
      >
        {waveformLevels.map((level, index) => {
          const isPast = index < playheadIndex
          const isPlayhead = index === playheadIndex
          return (
            <div key={index} className="relative flex h-full flex-1 items-center justify-center">
              <div
                className={cn(
                  "w-full min-w-px rounded-full",
                  isPast ? "bg-foreground/80" : "bg-muted-foreground/35"
                )}
                style={{ height: `${Math.round(8 + level * 22)}px` }}
              />
              {isPlayhead ? (
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/60" />
              ) : null}
            </div>
          )
        })}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-destructive hover:text-destructive"
        onClick={status === "paused" ? onResume : onPause}
        aria-label={status === "paused" ? "Retomar gravação" : "Pausar gravação"}
      >
        {status === "paused" ? <Play /> : <Pause />}
      </Button>
    </div>
  )
}
