"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  mapMicrophoneError,
  MicrophoneAccessError,
  requestMicrophoneStream,
} from "../utils/microphonePermission"

const DEFAULT_WAVEFORM_BAR_COUNT = 56
const IDLE_LEVEL = 0.02
const NOISE_GATE = 0.02
const SMOOTHING = 0.35

export type WhatsAppAudioRecorderStatus = "idle" | "recording" | "paused" | "preview"

interface UseWhatsAppAudioRecorderOptions {
  onSend: (file: File) => Promise<void>
  onError?: (error: MicrophoneAccessError) => void
  waveformBarCount?: number
}

function computeRms(data: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < data.length; i += 1) {
    const normalized = (data[i]! - 128) / 128
    sum += normalized * normalized
  }
  return Math.sqrt(sum / data.length)
}

function normalizeWaveformLevel(rms: number): number {
  const gated = Math.max(0, rms - NOISE_GATE)
  const boosted = Math.min(1, gated * 8)
  return Math.max(IDLE_LEVEL, Math.min(0.85, boosted))
}

export function useWhatsAppAudioRecorder({
  onSend,
  onError,
  waveformBarCount = DEFAULT_WAVEFORM_BAR_COUNT,
}: UseWhatsAppAudioRecorderOptions) {
  const barCount = Math.max(8, waveformBarCount)
  const [status, setStatus] = useState<WhatsAppAudioRecorderStatus>("idle")
  const [elapsedMs, setElapsedMs] = useState(0)
  const [waveformLevels, setWaveformLevels] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => IDLE_LEVEL)
  )
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const previewFileRef = useRef<File | null>(null)
  const enterPreviewOnStopRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)
  const pausedTotalRef = useRef(0)
  const pauseStartedAtRef = useRef<number | null>(null)
  const waveformBufferRef = useRef<number[]>(Array.from({ length: barCount }, () => IDLE_LEVEL))
  const smoothedLevelRef = useRef(IDLE_LEVEL)
  const timeDomainDataRef = useRef<Uint8Array | null>(null)
  const isSendingRef = useRef(false)
  const barCountRef = useRef(barCount)

  useEffect(() => {
    barCountRef.current = barCount
    waveformBufferRef.current = Array.from({ length: barCount }, () => IDLE_LEVEL)
    setWaveformLevels(Array.from({ length: barCount }, () => IDLE_LEVEL))
  }, [barCount])

  const cleanupMedia = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    void audioContextRef.current?.close().catch(() => undefined)
    audioContextRef.current = null
    analyserRef.current = null
    mediaRecorderRef.current = null
    timeDomainDataRef.current = null
  }, [])

  const resetState = useCallback(() => {
    cleanupMedia()
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    previewFileRef.current = null
    setStatus("idle")
    setElapsedMs(0)
    setWaveformLevels(Array.from({ length: barCountRef.current }, () => IDLE_LEVEL))
    waveformBufferRef.current = Array.from({ length: barCountRef.current }, () => IDLE_LEVEL)
    smoothedLevelRef.current = IDLE_LEVEL
    audioChunksRef.current = []
    enterPreviewOnStopRef.current = false
    startedAtRef.current = 0
    pausedTotalRef.current = 0
    pauseStartedAtRef.current = null
    isSendingRef.current = false
  }, [cleanupMedia, previewUrl])

  const updateElapsed = useCallback(() => {
    if (startedAtRef.current === 0) return
    const end = pauseStartedAtRef.current ?? Date.now()
    setElapsedMs(Math.max(0, end - startedAtRef.current - pausedTotalRef.current))
  }, [])

  const startWaveformLoop = useCallback(() => {
    const tick = () => {
      const analyser = analyserRef.current
      if (!analyser) return

      if (!timeDomainDataRef.current) {
        timeDomainDataRef.current = new Uint8Array(analyser.fftSize)
      }
      const data = timeDomainDataRef.current
      analyser.getByteTimeDomainData(data as Uint8Array<ArrayBuffer>)

      const target = normalizeWaveformLevel(computeRms(data))
      smoothedLevelRef.current =
        smoothedLevelRef.current * (1 - SMOOTHING) + target * SMOOTHING
      const count = barCountRef.current
      const buffer = waveformBufferRef.current
      const next =
        buffer.length === count
          ? [...buffer.slice(1), smoothedLevelRef.current]
          : Array.from({ length: count }, (_, i) =>
              i === count - 1 ? smoothedLevelRef.current : IDLE_LEVEL
            )
      waveformBufferRef.current = next
      setWaveformLevels(next)

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const stopWaveformLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    if (timerRef.current !== null) clearInterval(timerRef.current)
    timerRef.current = setInterval(updateElapsed, 200)
  }, [updateElapsed])

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(async (providedStream?: MediaStream) => {
    if (mediaRecorderRef.current) return

    try {
      const stream = providedStream ?? await requestMicrophoneStream()
      const recorder = new MediaRecorder(stream)
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      streamRef.current = stream
      mediaRecorderRef.current = recorder
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      audioChunksRef.current = []
      enterPreviewOnStopRef.current = false
      startedAtRef.current = Date.now()
      pausedTotalRef.current = 0
      pauseStartedAtRef.current = null

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const shouldPreview = enterPreviewOnStopRef.current
        const mimeType = recorder.mimeType || "audio/webm"
        const chunks = [...audioChunksRef.current]
        cleanupMedia()

        if (!shouldPreview) {
          resetState()
          return
        }

        const blob = new Blob(chunks, { type: mimeType })
        const file = new File([blob], `audio-${Date.now()}.webm`, {
          type: blob.type || "audio/webm",
        })
        previewFileRef.current = file
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setStatus("preview")
        enterPreviewOnStopRef.current = false
      }

      recorder.start()
      setStatus("recording")
      setElapsedMs(0)
      startTimer()
      startWaveformLoop()
    } catch (error) {
      const mapped =
        error instanceof MicrophoneAccessError ? error : mapMicrophoneError(error)
      onError?.(mapped)
      resetState()
    }
  }, [cleanupMedia, onError, resetState, startTimer, startWaveformLoop])

  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || status !== "recording") return
    recorder.pause()
    pauseStartedAtRef.current = Date.now()
    stopWaveformLoop()
    stopTimer()
    updateElapsed()
    setStatus("paused")
  }, [status, stopTimer, stopWaveformLoop, updateElapsed])

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || status !== "paused") return
    if (pauseStartedAtRef.current !== null) {
      pausedTotalRef.current += Date.now() - pauseStartedAtRef.current
      pauseStartedAtRef.current = null
    }
    recorder.resume()
    setStatus("recording")
    startTimer()
    startWaveformLoop()
  }, [startTimer, startWaveformLoop, status])

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current
    enterPreviewOnStopRef.current = false
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
      return
    }
    resetState()
  }, [resetState])

  const send = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || isSendingRef.current) return
    if (recorder.state === "inactive") return

    enterPreviewOnStopRef.current = true
    stopWaveformLoop()
    stopTimer()
    updateElapsed()
    recorder.stop()
  }, [stopTimer, stopWaveformLoop, updateElapsed])

  const confirmSend = useCallback(async () => {
    const file = previewFileRef.current
    if (!file || isSendingRef.current) return
    isSendingRef.current = true
    try {
      await onSend(file)
      resetState()
    } catch {
      isSendingRef.current = false
      onError?.(new MicrophoneAccessError("Falha ao enviar áudio", "Unknown"))
    }
  }, [onError, onSend, resetState])

  useEffect(() => () => {
    enterPreviewOnStopRef.current = false
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
    } else {
      cleanupMedia()
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [cleanupMedia, previewUrl])

  return {
    status,
    elapsedMs,
    waveformLevels,
    previewUrl,
    start,
    startWithStream: start,
    pause,
    resume,
    cancel,
    send,
    confirmSend,
    isRecording: status !== "idle",
  }
}
