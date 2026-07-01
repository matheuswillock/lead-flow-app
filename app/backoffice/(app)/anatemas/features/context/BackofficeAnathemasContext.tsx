"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { IBackofficeAnathemasService } from "../services/IBackofficeAnathemasService"
import { useBackofficeAnathemasHook } from "./BackofficeAnathemasHook"
import type {
  BackofficeAnathemaItem,
  BackofficeAnathemasFilters,
  BackofficeAnathemasListResult,
} from "./BackofficeAnathemasTypes"

interface BackofficeAnathemasContextValue {
  service: IBackofficeAnathemasService
  items: BackofficeAnathemaItem[]
  filters: BackofficeAnathemasFilters
  pagination: BackofficeAnathemasListResult["pagination"]
  isLoading: boolean
  isLifting: boolean
  error: string | null
  setFilters: (next: Partial<BackofficeAnathemasFilters>) => void
  setPage: (page: number) => void
  refresh: () => Promise<void>
  liftBan: (banId: string, liftReason?: string | null) => Promise<void>
}

const BackofficeAnathemasContext = createContext<BackofficeAnathemasContextValue | null>(null)

const defaultFilters: BackofficeAnathemasFilters = {
  query: "",
  status: "ACTIVE",
}

const defaultPagination: BackofficeAnathemasListResult["pagination"] = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}

interface BackofficeAnathemasProviderProps {
  children: React.ReactNode
  service: IBackofficeAnathemasService
}

export function BackofficeAnathemasProvider({
  children,
  service,
}: BackofficeAnathemasProviderProps) {
  useBackofficeAnathemasHook({ service })
  const [items, setItems] = useState<BackofficeAnathemaItem[]>([])
  const [filters, setFiltersState] = useState<BackofficeAnathemasFilters>(defaultFilters)
  const [page, setPageState] = useState(1)
  const [pagination, setPagination] =
    useState<BackofficeAnathemasListResult["pagination"]>(defaultPagination)
  const [isLoading, setIsLoading] = useState(true)
  const [isLifting, setIsLifting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const lastSuccessKeyRef = useRef<string | null>(null)

  const loadKey = useMemo(
    () => JSON.stringify({ filters, page }),
    [filters, page]
  )

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return
    if (lastSuccessKeyRef.current === loadKey) return

    inFlightRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const result = await service.list({ filters, page, pageSize: 20 })
      setItems(result.items)
      setPagination(result.pagination)
      lastSuccessKeyRef.current = loadKey
    } catch (err) {
      console.error("[BackofficeAnathemasProvider][refresh]", err)
      setError(err instanceof Error ? err.message : "Erro ao carregar anatemas")
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [filters, loadKey, page, service])

  useEffect(() => {
    lastSuccessKeyRef.current = null
    void refresh()
  }, [refresh])

  const setFilters = useCallback((next: Partial<BackofficeAnathemasFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }))
    setPageState(1)
    lastSuccessKeyRef.current = null
  }, [])

  const setPage = useCallback((nextPage: number) => {
    setPageState(nextPage)
    lastSuccessKeyRef.current = null
  }, [])

  const liftBan = useCallback(
    async (banId: string, liftReason?: string | null) => {
      if (isLifting) return
      setIsLifting(true)
      try {
        await service.liftBan(banId, liftReason)
        lastSuccessKeyRef.current = null
        await refresh()
      } finally {
        setIsLifting(false)
      }
    },
    [isLifting, refresh, service]
  )

  const value = useMemo(
    () => ({
      service,
      items,
      filters,
      pagination,
      isLoading,
      isLifting,
      error,
      setFilters,
      setPage,
      refresh,
      liftBan,
    }),
    [service, items, filters, pagination, isLoading, isLifting, error, setFilters, setPage, refresh, liftBan]
  )

  return (
    <BackofficeAnathemasContext.Provider value={value}>{children}</BackofficeAnathemasContext.Provider>
  )
}

export function useBackofficeAnathemas() {
  const context = useContext(BackofficeAnathemasContext)
  if (!context) {
    throw new Error("useBackofficeAnathemas must be used within BackofficeAnathemasProvider")
  }
  return context
}
