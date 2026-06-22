"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { DateRange } from "react-day-picker"
import type { IBackofficeAllUsersService } from "../services/IBackofficeAllUsersService"
import {
  DEFAULT_BACKOFFICE_SCHEDULE_FILTERS,
  type BackofficeAllUsersScheduleFilters,
  type BackofficeAllUsersScheduleItem,
  type BackofficeAllUsersScheduleTarget,
  type BackofficePagination,
} from "../context/BackofficeAllUsersTypes"

const SEARCH_DEBOUNCE_MS = 300

function filtersToDateRange(filters: BackofficeAllUsersScheduleFilters): DateRange | undefined {
  if (!filters.dateFrom && !filters.dateTo) return undefined
  return {
    from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
    to: filters.dateTo ? new Date(filters.dateTo) : undefined,
  }
}

function dateRangeToFilterValues(range: DateRange | undefined): Pick<
  BackofficeAllUsersScheduleFilters,
  "dateFrom" | "dateTo"
> {
  if (!range?.from && !range?.to) {
    return { dateFrom: null, dateTo: null }
  }

  return {
    dateFrom: range?.from ? range.from.toISOString() : null,
    dateTo: range?.to ? range.to.toISOString() : null,
  }
}

export function useBackofficeUserSchedules(
  service: IBackofficeAllUsersService,
  scheduleTarget: BackofficeAllUsersScheduleTarget | null,
  scheduleDialogOpen: boolean
) {
  const [filters, setFilters] = useState<BackofficeAllUsersScheduleFilters>(
    DEFAULT_BACKOFFICE_SCHEDULE_FILTERS
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [items, setItems] = useState<BackofficeAllUsersScheduleItem[]>([])
  const [pagination, setPagination] = useState<BackofficePagination | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState("")

  const fetchingRef = useRef(false)
  const lastSuccessKeyRef = useRef<string | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buildRequestKey = useCallback(
    (profileId: string, currentFilters: BackofficeAllUsersScheduleFilters, currentPage: number, currentPageSize: number) =>
      JSON.stringify({ profileId, currentFilters, currentPage, currentPageSize }),
    []
  )

  const fetchSchedules = useCallback(
    async (
      profileId: string,
      currentFilters: BackofficeAllUsersScheduleFilters,
      currentPage: number,
      currentPageSize: number
    ) => {
      const requestKey = buildRequestKey(profileId, currentFilters, currentPage, currentPageSize)
      if (fetchingRef.current || lastSuccessKeyRef.current === requestKey) return

      fetchingRef.current = true
      setIsLoading(true)
      setError(null)

      try {
        const result = await service.getSchedules(profileId, {
          filters: currentFilters,
          page: currentPage,
          pageSize: currentPageSize,
        })
        setItems(result.items)
        setPagination(result.pagination)
        lastSuccessKeyRef.current = requestKey
      } catch (fetchError) {
        console.error("[useBackofficeUserSchedules][fetchSchedules]", fetchError)
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Erro ao carregar agendamentos do usuário."
        )
        setItems([])
        setPagination(null)
      } finally {
        fetchingRef.current = false
        setIsLoading(false)
      }
    },
    [buildRequestKey, service]
  )

  const resetState = useCallback(() => {
    setFilters(DEFAULT_BACKOFFICE_SCHEDULE_FILTERS)
    setSearchInput("")
    setPage(1)
    setPageSize(10)
    setItems([])
    setPagination(null)
    setError(null)
    lastSuccessKeyRef.current = null
  }, [])

  useEffect(() => {
    if (!scheduleDialogOpen || !scheduleTarget) {
      resetState()
      return
    }

    resetState()
  }, [scheduleDialogOpen, scheduleTarget?.id, resetState])

  useEffect(() => {
    if (!scheduleDialogOpen || !scheduleTarget) return

    void fetchSchedules(scheduleTarget.id, filters, page, pageSize)
  }, [scheduleDialogOpen, scheduleTarget, filters, page, pageSize, fetchSchedules])

  const updateFilters = useCallback(
    (patch: Partial<BackofficeAllUsersScheduleFilters>) => {
      lastSuccessKeyRef.current = null
      setPage(1)
      setFilters((current) => ({ ...current, ...patch }))
    },
    []
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = setTimeout(() => {
        updateFilters({ query: value })
      }, SEARCH_DEBOUNCE_MS)
    },
    [updateFilters]
  )

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      updateFilters(dateRangeToFilterValues(range))
    },
    [updateFilters]
  )

  const clearFilters = useCallback(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    setSearchInput("")
    lastSuccessKeyRef.current = null
    setPage(1)
    setFilters(DEFAULT_BACKOFFICE_SCHEDULE_FILTERS)
  }, [])

  const hasActiveFilters =
    filters.query.trim().length > 0 ||
    filters.functions.length > 0 ||
    filters.meetingStatuses.length > 0 ||
    filters.leadStatuses.length > 0 ||
    filters.dateFrom !== null ||
    filters.dateTo !== null

  return {
    filters,
    searchInput,
    dateRange: filtersToDateRange(filters),
    page,
    pageSize,
    items,
    pagination,
    isLoading,
    error,
    hasActiveFilters,
    setPage,
    setPageSize: (value: number) => {
      lastSuccessKeyRef.current = null
      setPage(1)
      setPageSize(value)
    },
    updateFilters,
    handleSearchChange,
    handleDateRangeChange,
    clearFilters,
  }
}
