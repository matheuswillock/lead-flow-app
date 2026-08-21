"use client"

import { useEffect, useRef, useState } from "react"
import { CampaignAnalyticsService } from "../../services/CampaignAnalyticsService"
import type { OverviewData } from "./AnalyticsTypes"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"

const service = new CampaignAnalyticsService()

export function useCampaignsOverview(enabled = true) {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const lastSuccessKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    const requestKey = "overview"
    if (inFlightRef.current) return
    if (lastSuccessKeyRef.current === requestKey && data) return

    let cancelled = false
    inFlightRef.current = true
    setLoading(true)
    setError(null)

    void service
      .getOverview()
      .then((result) => {
        if (cancelled) return
        setData(result)
        lastSuccessKeyRef.current = requestKey
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(toUserToastMessage(err))
      })
      .finally(() => {
        inFlightRef.current = false
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { data, loading, error }
}
