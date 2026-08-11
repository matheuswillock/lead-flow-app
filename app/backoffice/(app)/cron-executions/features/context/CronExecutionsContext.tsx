"use client"

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { ICronExecutionsService } from "../services/ICronExecutionsService"
import {
  EMPTY_CRON_EXECUTIONS_FILTERS,
  filterCronExecutions,
  getCronKeyOptions,
  type CronExecutionItem,
  type CronExecutionsContextType,
  type CronExecutionsFiltersState,
} from "./CronExecutionsContextTypes"

const EXECUTIONS_WINDOW_LIMIT = 200

export const CronExecutionsContext = createContext<CronExecutionsContextType | undefined>(undefined)

type CronExecutionsProviderProps = {
  service: ICronExecutionsService
  children: ReactNode
}

/** Local date key (yyyy-MM-dd) → ISO instant covering the whole day. */
function toDayBoundaryIso(dateKey: string, boundary: "start" | "end"): string | undefined {
  if (!dateKey) return undefined
  const time = boundary === "start" ? "T00:00:00" : "T23:59:59.999"
  const date = new Date(`${dateKey}${time}`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export function CronExecutionsProvider({ service, children }: CronExecutionsProviderProps) {
  const [executions, setExecutions] = useState<CronExecutionItem[]>([])
  const [filters, setFiltersState] = useState<CronExecutionsFiltersState>(
    EMPTY_CRON_EXECUTIONS_FILTERS
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedExecution, setSelectedExecution] = useState<CronExecutionItem | null>(null)

  const inFlightKeyRef = useRef<string | null>(null)
  const lastSuccessKeyRef = useRef<string | null>(null)

  // Only the period narrows the server query; the remaining dimensions are
  // multi-select and are applied client-side over the fetched window.
  const requestKey = `${filters.periodStart}|${filters.periodEnd}`

  const loadExecutions = useCallback(
    async (key: string, force: boolean) => {
      if (inFlightKeyRef.current === key) return
      if (!force && lastSuccessKeyRef.current === key) return

      const [periodStart, periodEnd] = key.split("|")
      inFlightKeyRef.current = key
      setLoading(true)
      setError(null)

      try {
        const output = await service.listExecutions({
          startDate: toDayBoundaryIso(periodStart ?? "", "start"),
          endDate: toDayBoundaryIso(periodEnd ?? "", "end"),
          limit: EXECUTIONS_WINDOW_LIMIT,
        })

        if (output.isValid) {
          const result = output.result as { executions?: CronExecutionItem[] } | null
          setExecutions(result?.executions ?? [])
          lastSuccessKeyRef.current = key
        } else {
          setError(output.errorMessages.join(", "))
        }
      } catch (err) {
        console.error("[CronExecutionsProvider][loadExecutions]", err)
        setError("Erro ao carregar execuções")
      } finally {
        inFlightKeyRef.current = null
        setLoading(false)
      }
    },
    [service]
  )

  useEffect(() => {
    void loadExecutions(requestKey, false)
  }, [loadExecutions, requestKey])

  const refresh = useCallback(async () => {
    await loadExecutions(requestKey, true)
  }, [loadExecutions, requestKey])

  const setFilter = useCallback(
    <Key extends keyof CronExecutionsFiltersState>(
      key: Key,
      value: CronExecutionsFiltersState[Key]
    ) => {
      setFiltersState((previous) => ({ ...previous, [key]: value }))
    },
    []
  )

  const setFilters = useCallback((next: CronExecutionsFiltersState) => {
    setFiltersState(next)
  }, [])

  const clearFilters = useCallback(() => {
    setFiltersState(EMPTY_CRON_EXECUTIONS_FILTERS)
  }, [])

  const selectExecution = useCallback((execution: CronExecutionItem | null) => {
    setSelectedExecution(execution)
  }, [])

  const filteredExecutions = useMemo(
    () => filterCronExecutions(executions, filters),
    [executions, filters]
  )

  const cronKeyOptions = useMemo(() => getCronKeyOptions(executions), [executions])

  const value = useMemo<CronExecutionsContextType>(
    () => ({
      executions,
      filteredExecutions,
      cronKeyOptions,
      filters,
      loading,
      error,
      selectedExecution,
      setFilter,
      setFilters,
      clearFilters,
      refresh,
      selectExecution,
    }),
    [
      clearFilters,
      cronKeyOptions,
      error,
      executions,
      filteredExecutions,
      filters,
      loading,
      refresh,
      selectExecution,
      selectedExecution,
      setFilter,
      setFilters,
    ]
  )

  return (
    <CronExecutionsContext.Provider value={value}>{children}</CronExecutionsContext.Provider>
  )
}
