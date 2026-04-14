"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AnalyticsService } from "../services/AnalyticsService"
import type { AnalyticsData, AnalyticsPeriod } from "./AnalyticsTypes"

const service = new AnalyticsService()

export type AnalyticsActions = {
  handlePeriodChange: (period: AnalyticsPeriod) => void
  handleCampaignFilter: (campaignId: string) => void
}

export type AnalyticsHookReturn = {
  data: AnalyticsData | null
  loading: boolean
  period: AnalyticsPeriod
  campaignId: string
  campaigns: Array<{ id: string; name: string }>
} & AnalyticsActions

export function useAnalytics(supabaseId: string): AnalyticsHookReturn {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
  const [campaignId, setCampaignId] = useState("")
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([])
  const fetchingRef = useRef(false)

  const fetchData = useCallback(async (p: AnalyticsPeriod, cId: string) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    console.info("[useAnalytics] fetchData", { p, cId })
    try {
      const result = await service.getAnalytics(p, cId || undefined)
      setData(result)
    } catch (err) {
      console.error("[useAnalytics] fetchData error", err)
      toast.error("Erro ao carregar analytics")
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    void fetchData('30d', "")
    service.getCampaigns().then(setCampaigns).catch((err) => {
      console.error("[useAnalytics] getCampaigns error", err)
    })
  }, [supabaseId])

  const handlePeriodChange = useCallback((p: AnalyticsPeriod) => {
    setPeriod(p)
    void fetchData(p, campaignId)
  }, [fetchData, campaignId])

  const handleCampaignFilter = useCallback((cId: string) => {
    setCampaignId(cId)
    void fetchData(period, cId)
  }, [fetchData, period])

  return {
    data,
    loading,
    period,
    campaignId,
    campaigns,
    handlePeriodChange,
    handleCampaignFilter,
  }
}
