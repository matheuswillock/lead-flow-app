"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CampaignAnalyticsService } from "../../services/CampaignAnalyticsService"
import type { AnalyticsData, AnalyticsPeriod } from "./AnalyticsTypes"
import { useTimezone } from "@/app/context/TimezoneContext"

const service = new CampaignAnalyticsService()

export function useCampaignAnalytics(campaignId?: string, open = false) {
  const { tz } = useTimezone()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d")
  const fetchingRef = useRef(false)
  const lastKeyRef = useRef("")

  const fetchData = useCallback(
    async (p: AnalyticsPeriod, cId?: string) => {
      const key = `${p}:${cId ?? "all"}:${tz}`
      if (fetchingRef.current || lastKeyRef.current === key) return
      fetchingRef.current = true
      setLoading(true)
      try {
        const result = await service.getAnalytics(p, tz, cId)
        setData(result)
        lastKeyRef.current = key
      } catch (err) {
        console.error("[useCampaignAnalytics] fetchData error", err)
        toast.error("Erro ao carregar analytics")
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    },
    [tz]
  )

  useEffect(() => {
    if (!open) return
    lastKeyRef.current = ""
    void fetchData(period, campaignId)
  }, [open, period, campaignId, fetchData])

  const handlePeriodChange = useCallback((next: AnalyticsPeriod) => {
    lastKeyRef.current = ""
    setPeriod(next)
  }, [])

  return { data, loading, period, handlePeriodChange }
}
