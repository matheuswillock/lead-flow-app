"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { backofficeStudioEmailService } from "../../services/BackofficeStudioEmailService"
import type { StudioEmailLog, StudioEmailLogDetail } from "../../services/IBackofficeStudioEmailService"

const PAGE_SIZE = 20

export function useBackofficeHistorico(
  masterId: string,
  teamId: string | null,
  refreshKey: number
) {
  const [logs, setLogs] = useState<StudioEmailLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<StudioEmailLogDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const inFlightRef = useRef(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLogs = useCallback(
    async (opts: {
      page: number
      search: string
      status: string
      category: string
      from: string
      to: string
    }) => {
      if (!teamId || inFlightRef.current) return
      inFlightRef.current = true
      setLoading(true)
      try {
        const result = await backofficeStudioEmailService.listLogs(masterId, teamId, {
          page: opts.page,
          pageSize: PAGE_SIZE,
          search: opts.search || undefined,
          status: opts.status ? [opts.status] : undefined,
          category: opts.category || undefined,
          from: opts.from || undefined,
          to: opts.to || undefined,
        })
        setLogs(result.items)
        setTotal(result.total)
        setPage(result.page)
        setTotalPages(result.totalPages)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao carregar histórico")
      } finally {
        setLoading(false)
        inFlightRef.current = false
      }
    },
    [masterId, teamId]
  )

  useEffect(() => {
    if (!teamId) return
    void fetchLogs({ page: 1, search: "", status: "", category: "", from: "", to: "" })
  }, [teamId, refreshKey, fetchLogs])

  const handleSearch = useCallback(
    (query: string) => {
      setSearch(query)
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = setTimeout(() => {
        setPage(1)
        void fetchLogs({
          page: 1,
          search: query,
          status: statusFilter,
          category: categoryFilter,
          from: dateFrom,
          to: dateTo,
        })
      }, 300)
    },
    [categoryFilter, dateFrom, dateTo, fetchLogs, statusFilter]
  )

  const handleStatusFilter = useCallback(
    (status: string) => {
      setStatusFilter(status)
      setPage(1)
      void fetchLogs({
        page: 1,
        search,
        status,
        category: categoryFilter,
        from: dateFrom,
        to: dateTo,
      })
    },
    [categoryFilter, dateFrom, dateTo, fetchLogs, search]
  )

  const handleCategoryFilter = useCallback(
    (category: string) => {
      setCategoryFilter(category)
      setPage(1)
      void fetchLogs({
        page: 1,
        search,
        status: statusFilter,
        category,
        from: dateFrom,
        to: dateTo,
      })
    },
    [dateFrom, dateTo, fetchLogs, search, statusFilter]
  )

  const handleDateFilter = useCallback(
    (from: string, to: string) => {
      setDateFrom(from)
      setDateTo(to)
      setPage(1)
      void fetchLogs({
        page: 1,
        search,
        status: statusFilter,
        category: categoryFilter,
        from,
        to,
      })
    },
    [categoryFilter, fetchLogs, search, statusFilter]
  )

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setPage(nextPage)
      void fetchLogs({
        page: nextPage,
        search,
        status: statusFilter,
        category: categoryFilter,
        from: dateFrom,
        to: dateTo,
      })
    },
    [categoryFilter, dateFrom, dateTo, fetchLogs, search, statusFilter]
  )

  const handleOpenDetail = useCallback(
    async (logId: string) => {
      if (!teamId) return
      setSelectedLogId(logId)
      setSelectedLog(null)
      setLoadingDetail(true)
      try {
        const detail = await backofficeStudioEmailService.getLog(masterId, teamId, logId)
        setSelectedLog(detail)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao carregar detalhes")
      } finally {
        setLoadingDetail(false)
      }
    },
    [masterId, teamId]
  )

  const handleCloseDetail = useCallback(() => {
    setSelectedLogId(null)
    setSelectedLog(null)
  }, [])

  return {
    logs,
    total,
    page,
    totalPages,
    search,
    statusFilter,
    categoryFilter,
    dateFrom,
    dateTo,
    loading,
    selectedLogId,
    selectedLog,
    loadingDetail,
    handleSearch,
    handleStatusFilter,
    handleCategoryFilter,
    handleDateFilter,
    handlePageChange,
    handleOpenDetail,
    handleCloseDetail,
  }
}
