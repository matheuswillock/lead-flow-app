"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import type { IBackofficeAllUsersService } from "../services/IBackofficeAllUsersService"
import type {
  BackofficeAllUsersDetail,
  BackofficeAllUsersFilters,
  BackofficeAllUsersItem,
  BackofficePagination,
} from "./BackofficeAllUsersTypes"

const DEFAULT_FILTERS: BackofficeAllUsersFilters = {
  query: "",
  role: "all",
  plan: "all",
}

const DEFAULT_PAGINATION: BackofficePagination = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}

interface BackofficeAllUsersContextValue {
  service: IBackofficeAllUsersService
  items: BackofficeAllUsersItem[]
  pagination: BackofficePagination
  isLoading: boolean
  error: string | null
  filters: BackofficeAllUsersFilters
  selectedDetail: BackofficeAllUsersDetail | null
  isDetailLoading: boolean
  detailError: string | null
  sheetOpen: boolean
  setFilters: (next: BackofficeAllUsersFilters) => void
  fetchUsers: (options?: {
    filters?: Partial<BackofficeAllUsersFilters>
    page?: number
    pageSize?: number
  }) => Promise<void>
  setUsersPage: (page: number) => Promise<void>
  setUsersPageSize: (pageSize: number) => Promise<void>
  clearFilters: () => Promise<void>
  openUserSheet: (profileId: string) => Promise<void>
  closeUserSheet: () => void
}

const BackofficeAllUsersContext = createContext<BackofficeAllUsersContextValue | undefined>(undefined)

interface Props {
  children: ReactNode
  service: IBackofficeAllUsersService
}

export function BackofficeAllUsersProvider({ children, service }: Props) {
  const [items, setItems] = useState<BackofficeAllUsersItem[]>([])
  const [pagination, setPagination] = useState<BackofficePagination>(DEFAULT_PAGINATION)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<BackofficeAllUsersFilters>(DEFAULT_FILTERS)
  const [selectedDetail, setSelectedDetail] = useState<BackofficeAllUsersDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const inFlight = useRef(false)
  const detailRequestId = useRef(0)

  const loadUsers = useCallback(async (
    targetFilters: BackofficeAllUsersFilters,
    targetPage: number,
    targetPageSize: number
  ) => {
    if (inFlight.current) return

    inFlight.current = true
    setIsLoading(true)
    setError(null)

    try {
      const result = await service.list({
        filters: targetFilters,
        page: targetPage,
        pageSize: targetPageSize,
      })
      setItems(result.items)
      setPagination(result.pagination)
      setFilters(targetFilters)
    } catch (err) {
      console.error("[BackofficeAllUsersContext]", err)
      setError(err instanceof Error ? err.message : "Erro ao carregar usuários")
      setItems([])
      setPagination((prev) => ({
        ...prev,
        page: targetPage,
        pageSize: targetPageSize,
      }))
    } finally {
      setIsLoading(false)
      inFlight.current = false
    }
  }, [service])

  const fetchUsers = useCallback(async (options?: {
    filters?: Partial<BackofficeAllUsersFilters>
    page?: number
    pageSize?: number
  }) => {
    const mergedFilters: BackofficeAllUsersFilters = {
      ...filters,
      ...(options?.filters ?? {}),
    }
    const page = Math.max(options?.page ?? pagination.page, 1)
    const pageSize = Math.max(options?.pageSize ?? pagination.pageSize, 5)
    await loadUsers(mergedFilters, page, pageSize)
  }, [filters, loadUsers, pagination.page, pagination.pageSize])

  const setUsersPage = useCallback(async (page: number) => {
    const nextPage = Math.max(page, 1)
    await loadUsers(filters, nextPage, pagination.pageSize)
  }, [filters, loadUsers, pagination.pageSize])

  const setUsersPageSize = useCallback(async (pageSize: number) => {
    const nextPageSize = Math.max(pageSize, 5)
    await loadUsers(filters, 1, nextPageSize)
  }, [filters, loadUsers])

  const clearFilters = useCallback(async () => {
    await loadUsers(DEFAULT_FILTERS, 1, pagination.pageSize)
  }, [loadUsers, pagination.pageSize])

  const closeUserSheet = useCallback(() => {
    setSheetOpen(false)
    setDetailError(null)
  }, [])

  const openUserSheet = useCallback(async (profileId: string) => {
    const requestId = ++detailRequestId.current
    setSheetOpen(true)
    setIsDetailLoading(true)
    setDetailError(null)
    setSelectedDetail(null)

    try {
      const detail = await service.getDetail(profileId)
      if (detailRequestId.current !== requestId) return
      setSelectedDetail(detail)
    } catch (err) {
      if (detailRequestId.current !== requestId) return
      console.error("[BackofficeAllUsersContext][openUserSheet]", err)
      setDetailError(err instanceof Error ? err.message : "Erro ao carregar detalhes")
    } finally {
      if (detailRequestId.current === requestId) {
        setIsDetailLoading(false)
      }
    }
  }, [service])

  useEffect(() => {
    void loadUsers(DEFAULT_FILTERS, 1, DEFAULT_PAGINATION.pageSize)
  }, [loadUsers])

  return (
    <BackofficeAllUsersContext.Provider
      value={{
        service,
        items,
        pagination,
        isLoading,
        error,
        filters,
        selectedDetail,
        isDetailLoading,
        detailError,
        sheetOpen,
        setFilters,
        fetchUsers,
        setUsersPage,
        setUsersPageSize,
        clearFilters,
        openUserSheet,
        closeUserSheet,
      }}
    >
      {children}
    </BackofficeAllUsersContext.Provider>
  )
}

export function useBackofficeAllUsers(): BackofficeAllUsersContextValue {
  const ctx = useContext(BackofficeAllUsersContext)
  if (!ctx) throw new Error("useBackofficeAllUsers must be used within BackofficeAllUsersProvider")
  return ctx
}
