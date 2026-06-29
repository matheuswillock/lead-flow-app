"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  mapMicrophoneError,
  MicrophoneAccessError,
  requestMicrophoneStream,
} from "../utils/microphonePermission"

const WAVEFORM_BAR_COUNT = 56

export type WhatsAppAudioRecorderStatus = "idle" | "recording" | "paused"

interface UseWhatsAppAudioRecorderOptions {
  onSend: (file: File) => Promise<void>
  onError?: (error: MicrophoneAccessError) => void
}

function computeRms(data: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < data.length; i += 1) {
    const normalized = (data[i]! - 128) / 128
    sum += normalized * normalized
  }
  return Math.sqrt(sum / data.length)
}

export function useWhatsAppAudioRecorder({ onSend, onError }: UseWhatsAppAudioRecorderOptions) {
  const [status, setStatus] = useState<WhatsAppAudioRecorderStatus>("idle")
  const [elapsedMs, setElapsedMs] = useState(0)
  const [waveformLevels, setWaveformLevels] = useState<number[]>(() =>
    Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0.08)
  )

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const sendOnStopRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef(0)
  const pausedTotalRef = useRef(0)
  const pauseStartedAtRef = useRef<number | null>(null)
  const waveformBufferRef = useRef<number[]>(Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0.08))
  const timeDomainDataRef = useRef<Uint8Array | null>(null)
  const isSendingRef = useRef(false)

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
    setStatus("idle")
    setElapsedMs(0)
    setWaveformLevels(Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0.08))
    waveformBufferRef.current = Array.from({ length: WAVEFORM_BAR_COUNT }, () => 0.08)
    audioChunksRef.current = []
    sendOnStopRef.current = false
    startedAtRef.current = 0
    pausedTotalRef.current = 0
    pauseStartedAtRef.current = null
    isSendingRef.current = false
  }, [cleanupMedia])

  const updateElapsed = useCallback(() => {
    if (startedAtRef.current === 0) return
    const pauseOffset =
      pauseStartedAtRef.current !== null
        ? pauseStartedAtRef.current - startedAtRef.current - pausedTotalRef.current
        : 0
    const end = pauseStartedAtRef.current ?? Date.now()
    setElapsedMs(Math.max(0, end - startedAtRef.current - pausedTotalRef.current - pauseOffset))
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

      const rms = computeRms(data)
      const level = Math.min(1, Math.max(0.08, rms * 3.5))
      const next = [...waveformBufferRef.current.slice(1), level]
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

  const start = useCallback(async () => {
    if (mediaRecorderRef.current) return

    try {
      const stream = await requestMicrophoneStream()
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
      sendOnStopRef.current = false
      startedAtRef.current = Date.now()
      pausedTotalRef.current = 0
      pauseStartedAtRef.current = null

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const shouldSend = sendOnStopRef.current
        const mimeType = recorder.mimeType || "audio/webm"
        const chunks = [...audioChunksRef.current]
        cleanupMedia()

        if (!shouldSend) {
          resetState()
          return
        }

        const blob = new Blob(chunks, { type: mimeType })
        const file = new File([blob], `audio-${Date.now()}.webm`, {
          type: blob.type || "audio/webm",
        })

        void onSend(file)
          .catch(() => onError?.(new MicrophoneAccessError("Falha ao enviar áudio", "Unknown")))
          .finally(() => {
            resetState()
          })
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
  }, [cleanupMedia, onError, onSend, resetState, startTimer, startWaveformLoop])

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
    sendOnStopRef.current = false
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

    isSendingRef.current = true
    sendOnStopRef.current = true
    stopWaveformLoop()
    stopTimer()
    updateElapsed()
    recorder.stop()
  }, [stopTimer, stopWaveformLoop, updateElapsed])

  useEffect(() => () => {
    sendOnStopRef.current = false
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
    } else {
      cleanupMedia()
    }
  }, [cleanupMedia])

  return {
    status,
    elapsedMs,
    waveformLevels,
    start,
    pause,
    resume,
    cancel,
    send,
    isRecording: status !== "idle",
  }
}
