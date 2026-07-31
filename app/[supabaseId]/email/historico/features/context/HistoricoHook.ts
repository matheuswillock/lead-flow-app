"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { HistoricoService } from "../services/HistoricoService"
import type { EmailLog, LogDetail } from "./HistoricoTypes"
import { useOptionalStudioEmailHost } from "@/lib/email/studio-email-host"

const PAGE_SIZE = 20
const defaultService = new HistoricoService()

export type HistoricoActions = {
  handleSearch: (query: string) => void
  handleStatusFilter: (status: string) => void
  handleCategoryFilter: (category: string) => void
  handleDateFilter: (from: string, to: string) => void
  handlePageChange: (page: number) => void
  handleOpenDetail: (logId: string) => Promise<void>
  handleCloseDetail: () => void
}

export type HistoricoHookReturn = {
  logs: EmailLog[]
  total: number
  page: number
  totalPages: number
  search: string
  statusFilter: string
  categoryFilter: string
  dateFrom: string
  dateTo: string
  loading: boolean
  selectedLogId: string | null
  selectedLog: LogDetail | null
  loadingDetail: boolean
} & HistoricoActions

export function useHistorico(supabaseId: string): HistoricoHookReturn {
  const host = useOptionalStudioEmailHost()
  const service = host?.services.historico ?? defaultService
  const [logs, setLogs] = useState<EmailLog[]>([])
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
  const [selectedLog, setSelectedLog] = useState<LogDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchingRef = useRef(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLogs = useCallback(async (opts: {
    page: number
    search: string
    status: string
    category: string
    from: string
    to: string
  }) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    console.info("[useHistorico] fetchLogs", opts)
    try {
      const result = await service.getLogs({
        page: opts.page,
        pageSize: PAGE_SIZE,
        search: opts.search || undefined,
        status: opts.status || undefined,
        category: opts.category || undefined,
        from: opts.from || undefined,
        to: opts.to || undefined,
      })
      setLogs(result.logs)
      setTotal(result.total)
      setPage(result.page)
      setTotalPages(result.totalPages)
    } catch (err) {
      console.error("[useHistorico] fetchLogs error", err)
      toast.error("Erro ao carregar histórico")
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    void fetchLogs({ page: 1, search: "", status: "", category: "", from: "", to: "" })
  }, [supabaseId, fetchLogs])

  const handleSearch = useCallback((query: string) => {
    setSearch(query)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setPage(1)
      void fetchLogs({ page: 1, search: query, status: statusFilter, category: categoryFilter, from: dateFrom, to: dateTo })
    }, 300)
  }, [fetchLogs, statusFilter, categoryFilter, dateFrom, dateTo])

  const handleStatusFilter = useCallback((status: string) => {
    setStatusFilter(status)
    setPage(1)
    void fetchLogs({ page: 1, search, status, category: categoryFilter, from: dateFrom, to: dateTo })
  }, [fetchLogs, search, categoryFilter, dateFrom, dateTo])

  const handleCategoryFilter = useCallback((category: string) => {
    setCategoryFilter(category)
    setPage(1)
    void fetchLogs({ page: 1, search, status: statusFilter, category, from: dateFrom, to: dateTo })
  }, [fetchLogs, search, statusFilter, dateFrom, dateTo])

  const handleDateFilter = useCallback((from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
    setPage(1)
    void fetchLogs({ page: 1, search, status: statusFilter, category: categoryFilter, from, to })
  }, [fetchLogs, search, statusFilter, categoryFilter])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
    void fetchLogs({ page: nextPage, search, status: statusFilter, category: categoryFilter, from: dateFrom, to: dateTo })
  }, [fetchLogs, search, statusFilter, categoryFilter, dateFrom, dateTo])

  const handleOpenDetail = useCallback(async (logId: string) => {
    setSelectedLogId(logId)
    setSelectedLog(null)
    setLoadingDetail(true)
    console.info("[useHistorico] handleOpenDetail", logId)
    try {
      const detail = await service.getLogDetail(logId)
      setSelectedLog(detail)
    } catch (err) {
      console.error("[useHistorico] handleOpenDetail error", err)
      toast.error("Erro ao carregar detalhes do email")
    } finally {
      setLoadingDetail(false)
    }
  }, [])

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
