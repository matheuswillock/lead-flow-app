"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { backofficeStudioEmailService } from "../../services/BackofficeStudioEmailService"
import type { StudioEmailAnalytics } from "../../services/IBackofficeStudioEmailService"

export type BackofficeMetricsPeriod = "7d" | "30d" | "3m" | "6m"

function periodToRange(period: BackofficeMetricsPeriod): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  if (period === "7d") from.setDate(from.getDate() - 7)
  else if (period === "30d") from.setDate(from.getDate() - 30)
  else if (period === "3m") from.setMonth(from.getMonth() - 3)
  else from.setMonth(from.getMonth() - 6)

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export function useBackofficeMetrics(
  masterId: string,
  teamId: string | null,
  refreshKey: number
) {
  const [period, setPeriod] = useState<BackofficeMetricsPeriod>("30d")
  const [data, setData] = useState<StudioEmailAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const inFlightRef = useRef(false)

  const fetchAnalytics = useCallback(async () => {
    if (!teamId || inFlightRef.current) return
    const range = periodToRange(period)

    inFlightRef.current = true
    setLoading(true)
    try {
      const result = await backofficeStudioEmailService.getAnalytics(masterId, teamId, range)
      setData(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar métricas")
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [masterId, period, refreshKey, teamId])

  useEffect(() => {
    void fetchAnalytics()
  }, [fetchAnalytics])

  return {
    data,
    loading,
    period,
    setPeriod,
    refresh: fetchAnalytics,
  }
}
