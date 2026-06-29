"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDuration } from "../utils/formatDuration"

const PLAYBACK_RATES = [1, 1.5, 2] as const

interface WhatsAppAudioPlayerProps {
  src: string
  className?: string
  variant?: "inbound" | "outbound"
  duration?: number
}

function resolveDuration(audio: HTMLAudioElement, fallback?: number): number {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration
  if (fallback !== undefined && Number.isFinite(fallback) && fallback > 0) return fallback
  return 0
}

export function WhatsAppAudioPlayer({
  src,
  className,
  variant = "inbound",
  duration: durationProp,
}: WhatsAppAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(durationProp ?? 0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState<(typeof PLAYBACK_RATES)[number]>(1)

  const syncDuration = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const resolved = resolveDuration(audio, durationProp)
    if (resolved > 0) setDuration(resolved)
  }, [durationProp])

  useEffect(() => {
    setDuration(durationProp ?? 0)
    setCurrentTime(0)
    setIsPlaying(false)
    setPlaybackRate(1)
  }, [src, durationProp])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.playbackRate = playbackRate

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    const onDuration = () => syncDuration()

    audio.addEventListener("loadedmetadata", onDuration)
    audio.addEventListener("durationchange", onDuration)
    audio.addEventListener("loadeddata", onDuration)
    audio.addEventListener("canplay", onDuration)
    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("ended", onEnded)

    syncDuration()

    return () => {
      audio.removeEventListener("loadedmetadata", onDuration)
      audio.removeEventListener("durationchange", onDuration)
      audio.removeEventListener("loadeddata", onDuration)
      audio.removeEventListener("canplay", onDuration)
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("ended", onEnded)
    }
  }, [src, playbackRate, syncDuration])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }

    audio.playbackRate = playbackRate
    void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
  }, [isPlaying, playbackRate])

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRate((current) => {
      const index = PLAYBACK_RATES.indexOf(current)
      const next = PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length] ?? 1
      const audio = audioRef.current
      if (audio) audio.playbackRate = next
      return next
    })
  }, [])

  const seek = useCallback(
    (clientX: number) => {
      const audio = audioRef.current
      const bar = progressRef.current
      if (!audio || !bar || duration <= 0) return

      const rect = bar.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
      const nextTime = ratio * duration
      audio.currentTime = nextTime
      setCurrentTime(nextTime)
    },
    [duration]
  )

  const handleProgressPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      seek(event.clientX)

      const onPointerMove = (moveEvent: PointerEvent) => seek(moveEvent.clientX)
      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove)
        window.removeEventListener("pointerup", onPointerUp)
      }

      window.addEventListener("pointermove", onPointerMove)
      window.addEventListener("pointerup", onPointerUp)
    },
    [seek]
  )

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const isOutbound = variant === "outbound"
  const timeLabel =
    isPlaying || currentTime > 0
      ? duration > 0
        ? `${formatDuration(currentTime)} / ${formatDuration(duration)}`
        : formatDuration(currentTime)
      : formatDuration(duration)

  const speedLabel = playbackRate === 1 ? "1x" : `${playbackRate}x`

  return (
    <div className={cn("flex min-w-[220px] max-w-xs items-center gap-2", className)}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "shrink-0 rounded-full",
          isOutbound
            ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
            : "bg-foreground/10 text-foreground hover:bg-foreground/15"
        )}
        onClick={togglePlay}
        aria-label={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
      >
        {isPlaying ? <Pause /> : <Play />}
      </Button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          ref={progressRef}
          role="slider"
          aria-label="Progresso do áudio"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          tabIndex={0}
          className={cn(
            "relative h-2 w-full cursor-pointer overflow-hidden rounded-full",
            isOutbound ? "bg-primary-foreground/25" : "bg-foreground/15"
          )}
          onPointerDown={handleProgressPointerDown}
          onKeyDown={(event) => {
            const audio = audioRef.current
            if (!audio || duration <= 0) return
            const step = event.key === "ArrowRight" ? 5 : event.key === "ArrowLeft" ? -5 : 0
            if (step === 0) return
            event.preventDefault()
            const nextTime = Math.min(duration, Math.max(0, audio.currentTime + step))
            audio.currentTime = nextTime
            setCurrentTime(nextTime)
          }}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-75",
              isOutbound ? "bg-primary-foreground" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
          {isPlaying && progress > 0 ? (
            <div
              className={cn(
                "absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full",
                isOutbound ? "bg-primary-foreground" : "bg-primary"
              )}
              style={{ left: `calc(${progress}% - 5px)` }}
            />
          ) : null}
        </div>
        <span
          className={cn(
            "text-[10px] tabular-nums",
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {timeLabel}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 shrink-0 px-2 text-[10px] font-medium tabular-nums",
          isOutbound
            ? "text-primary-foreground/80 hover:bg-primary-foreground/20 hover:text-primary-foreground"
            : "text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        )}
        onClick={cyclePlaybackRate}
        aria-label={`Velocidade de reprodução: ${speedLabel}`}
      >
        {speedLabel}
      </Button>
    </div>
  )
}
