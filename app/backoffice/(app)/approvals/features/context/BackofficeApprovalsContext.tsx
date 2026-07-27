"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { IBackofficeApprovalsService } from "../services/IBackofficeApprovalsService"
import { useBackofficeApprovalsHook } from "./BackofficeApprovalsHook"
import type {
  BackofficeApprovalsFilters,
  BackofficeDeletionApprovalDecision,
  BackofficeDeletionRequestItem,
} from "./BackofficeApprovalsTypes"

interface BackofficeApprovalsContextValue {
  service: IBackofficeApprovalsService
  items: BackofficeDeletionRequestItem[]
  filters: BackofficeApprovalsFilters
  isLoading: boolean
  isDeciding: boolean
  decidingRequestId: string | null
  error: string | null
  setFilters: (next: Partial<BackofficeApprovalsFilters>) => void
  refresh: () => Promise<void>
  decide: (requestId: string, decision: BackofficeDeletionApprovalDecision) => Promise<void>
}

const BackofficeApprovalsContext = createContext<BackofficeApprovalsContextValue | null>(null)

const defaultFilters: BackofficeApprovalsFilters = {
  status: "pending",
}

interface BackofficeApprovalsProviderProps {
  children: React.ReactNode
  service: IBackofficeApprovalsService
}

export function BackofficeApprovalsProvider({
  children,
  service,
}: BackofficeApprovalsProviderProps) {
  useBackofficeApprovalsHook({ service })
  const [items, setItems] = useState<BackofficeDeletionRequestItem[]>([])
  const [filters, setFiltersState] = useState<BackofficeApprovalsFilters>(defaultFilters)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeciding, setIsDeciding] = useState(false)
  const [decidingRequestId, setDecidingRequestId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const lastSuccessKeyRef = useRef<string | null>(null)

  const loadKey = useMemo(() => JSON.stringify({ filters }), [filters])

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return
    if (lastSuccessKeyRef.current === loadKey) return

    inFlightRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const result = await service.list({ filters })
      setItems(result.items)
      lastSuccessKeyRef.current = loadKey
    } catch (err) {
      console.error("[BackofficeApprovalsProvider][refresh]", err)
      setError(err instanceof Error ? err.message : "Erro ao carregar aprovações")
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [filters, loadKey, service])

  useEffect(() => {
    lastSuccessKeyRef.current = null
    void refresh()
  }, [refresh])

  const setFilters = useCallback((next: Partial<BackofficeApprovalsFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }))
    lastSuccessKeyRef.current = null
  }, [])

  const decide = useCallback(
    async (requestId: string, decision: BackofficeDeletionApprovalDecision) => {
      if (isDeciding) return
      setIsDeciding(true)
      setDecidingRequestId(requestId)
      try {
        await service.decide(requestId, decision)
        lastSuccessKeyRef.current = null
        await refresh()
      } finally {
        setIsDeciding(false)
        setDecidingRequestId(null)
      }
    },
    [isDeciding, refresh, service]
  )

  const value = useMemo(
    () => ({
      service,
      items,
      filters,
      isLoading,
      isDeciding,
      decidingRequestId,
      error,
      setFilters,
      refresh,
      decide,
    }),
    [
      service,
      items,
      filters,
      isLoading,
      isDeciding,
      decidingRequestId,
      error,
      setFilters,
      refresh,
      decide,
    ]
  )

  return (
    <BackofficeApprovalsContext.Provider value={value}>{children}</BackofficeApprovalsContext.Provider>
  )
}

export function useBackofficeApprovals() {
  const context = useContext(BackofficeApprovalsContext)
  if (!context) {
    throw new Error("useBackofficeApprovals must be used within BackofficeApprovalsProvider")
  }
  return context
}
