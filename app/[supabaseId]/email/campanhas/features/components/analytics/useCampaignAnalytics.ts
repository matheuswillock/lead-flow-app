"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CampaignAnalyticsService } from "../../services/CampaignAnalyticsService"
import type { AnalyticsData, AnalyticsPeriod } from "./AnalyticsTypes"
import { useTimezone } from "@/app/context/TimezoneContext"

const service = new CampaignAnalyticsService()

const WEBHOOK_POLL_INTERVAL_MS = 30_000

export function useCampaignAnalytics(campaignId?: string, open = false) {
  const { tz } = useTimezone()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d")
  const fetchingRef = useRef(false)
  const lastKeyRef = useRef("")

  const fetchData = useCallback(
    async (
      p: AnalyticsPeriod,
      cId?: string,
      options?: { force?: boolean; silent?: boolean }
    ) => {
      const force = options?.force ?? false
      const silent = options?.silent ?? false
      const key = `${p}:${cId ?? "all"}:${tz}`
      if (fetchingRef.current || (!force && lastKeyRef.current === key)) return
      fetchingRef.current = true
      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      try {
        const result = await service.getAnalytics(p, tz, cId)
        setData(result)
        lastKeyRef.current = key
      } catch (err) {
        console.error("[useCampaignAnalytics] fetchData error", err)
        if (!silent) {
          toast.error("Erro ao carregar analytics")
        }
      } finally {
        if (silent) {
          setRefreshing(false)
        } else {
          setLoading(false)
        }
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

  useEffect(() => {
    if (!open) return

    const intervalId = window.setInterval(() => {
      void fetchData(period, campaignId, { force: true, silent: true })
    }, WEBHOOK_POLL_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [open, period, campaignId, fetchData])

  const handlePeriodChange = useCallback((next: AnalyticsPeriod) => {
    lastKeyRef.current = ""
    setPeriod(next)
  }, [])

  const handleRefresh = useCallback(() => {
    void fetchData(period, campaignId, { force: true, silent: true })
  }, [fetchData, period, campaignId])

  const initialLoading = loading && !data

  return {
    data,
    initialLoading,
    refreshing,
    period,
    handlePeriodChange,
    handleRefresh,
  }
}
