"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import type { IBackofficeEmailAnalyticsService } from "../services/IBackofficeEmailAnalyticsService"
import type {
  AnalyticsData,
  AnalyticsPeriod,
  BackofficeCampaignOption,
} from "./BackofficeEmailAnalyticsTypes"

export interface BackofficeEmailAnalyticsContextValue {
  data: AnalyticsData | null
  campaignOptions: BackofficeCampaignOption[]
  period: AnalyticsPeriod
  campaignId: string | undefined
  isLoading: boolean
  isRefreshing: boolean
  setPeriod: (period: AnalyticsPeriod) => void
  setCampaignId: (campaignId: string | undefined) => void
  refresh: () => Promise<void>
}

export const BackofficeEmailAnalyticsContext = createContext<
  BackofficeEmailAnalyticsContextValue | undefined
>(undefined)

interface ProviderProps {
  children: ReactNode
  service: IBackofficeEmailAnalyticsService
}

const POLL_INTERVAL_MS = 30_000

export function BackofficeEmailAnalyticsProvider({ children, service }: ProviderProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [campaignOptions, setCampaignOptions] = useState<BackofficeCampaignOption[]>([])
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d")
  const [campaignId, setCampaignId] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const fetchingRef = useRef(false)

  const fetchData = useCallback(
    async (silent = false) => {
      if (fetchingRef.current) return
      fetchingRef.current = true
      if (silent) setIsRefreshing(true)
      else setIsLoading(true)
      try {
        const result = await service.getAnalytics(period, campaignId)
        setData(result)
      } catch (err) {
        console.error("[BackofficeEmailAnalyticsContext][fetchData]", err)
        if (!silent) toast.error(err instanceof Error ? err.message : "Erro ao carregar analytics")
      } finally {
        if (silent) setIsRefreshing(false)
        else setIsLoading(false)
        fetchingRef.current = false
      }
    },
    [service, period, campaignId]
  )

  const refresh = useCallback(async () => {
    await fetchData(true)
  }, [fetchData])

  useEffect(() => {
    void service.listCampaignOptions().then(setCampaignOptions).catch((err) => {
      console.error("[BackofficeEmailAnalyticsContext][listCampaignOptions]", err)
    })
  }, [service])

  useEffect(() => {
    void fetchData(false)
  }, [fetchData])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchData(true)
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [fetchData])

  const value = useMemo<BackofficeEmailAnalyticsContextValue>(
    () => ({
      data,
      campaignOptions,
      period,
      campaignId,
      isLoading,
      isRefreshing,
      setPeriod,
      setCampaignId,
      refresh,
    }),
    [data, campaignOptions, period, campaignId, isLoading, isRefreshing, refresh]
  )

  return (
    <BackofficeEmailAnalyticsContext.Provider value={value}>
      {children}
    </BackofficeEmailAnalyticsContext.Provider>
  )
}
