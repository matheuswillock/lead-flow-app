"use client"

import { useCallback, useEffect, useState } from "react"

/** Tempo que o pedido fica reservado para o pagamento nesta sessão do navegador. */
export const ADHESION_ATTEMPT_DURATION_MS = 25 * 60 * 1000

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function readStart(storageKey: string): number | null {
  try {
    const stored = Number(window.sessionStorage.getItem(storageKey))
    return Number.isFinite(stored) && stored > 0 ? stored : null
  } catch {
    return null
  }
}

function writeStart(storageKey: string, start: number) {
  try {
    window.sessionStorage.setItem(storageKey, String(start))
  } catch {
    // sem sessionStorage o relógio só vale enquanto a página estiver aberta
  }
}

/** Contagem regressiva da tentativa de pagamento, guardada na sessão para sobreviver a recarregar a página. */
export function useAdhesionAttemptTimer(storageKey: string, durationMs = ADHESION_ATTEMPT_DURATION_MS) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const existing = readStart(storageKey)
    if (existing) {
      setStartedAt(existing)
      return
    }
    const start = Date.now()
    writeStart(storageKey, start)
    setStartedAt(start)
  }, [storageKey])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const restart = useCallback(() => {
    const start = Date.now()
    writeStart(storageKey, start)
    setStartedAt(start)
    setNow(start)
  }, [storageKey])

  const remainingMs = startedAt == null ? null : startedAt + durationMs - now
  return { remainingMs, isExpired: remainingMs != null && remainingMs <= 0, now, restart }
}
