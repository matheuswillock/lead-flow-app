"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  CAMPAIGN_DISPATCH_COUNTDOWN_START_SECONDS,
  CAMPAIGN_DISPATCH_COUNTDOWN_TICK_MS,
  formatCampaignDispatchCountdownLabel,
  nextCampaignDispatchCountdownStep,
  shouldShowCampaignDispatchCountdownLoader,
  type CampaignDispatchCountdownStep,
} from "@/lib/email/campaign-dispatch-countdown"

export function useCampaignDispatchCountdown(params: {
  isFailedRetry: boolean
  onDispatched: () => void
}) {
  const [step, setStep] = useState<CampaignDispatchCountdownStep | null>(null)
  const onDispatchedRef = useRef(params.onDispatched)
  onDispatchedRef.current = params.onDispatched

  const locked = step !== null

  const start = useCallback(() => {
    setStep((current) => current ?? CAMPAIGN_DISPATCH_COUNTDOWN_START_SECONDS)
  }, [])

  const reset = useCallback(() => {
    setStep(null)
  }, [])

  useEffect(() => {
    if (step === null) return

    const timeoutId = window.setTimeout(() => {
      const next = nextCampaignDispatchCountdownStep(step)
      if (next === "fire") {
        try {
          onDispatchedRef.current()
        } finally {
          setStep(null)
        }
        return
      }
      setStep(next)
    }, CAMPAIGN_DISPATCH_COUNTDOWN_TICK_MS)

    return () => window.clearTimeout(timeoutId)
  }, [step])

  const label =
    step === null
      ? null
      : formatCampaignDispatchCountdownLabel(step, params.isFailedRetry)

  return {
    locked,
    label,
    showLoader: shouldShowCampaignDispatchCountdownLoader(step),
    start,
    reset,
  }
}
