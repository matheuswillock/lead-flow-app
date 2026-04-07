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
import type { IBackofficeClientsService } from "../services/IBackofficeClientsService"
import type {
  BackofficeClientItem,
  BackofficeClientsFilters,
  BackofficePagination,
} from "./BackofficeClientsTypes"

const DEFAULT_FILTERS: BackofficeClientsFilters = {
  query: "",
}

const DEFAULT_PAGINATION: BackofficePagination = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}

interface ClientsContextValue {
  clients: BackofficeClientItem[]
  pagination: BackofficePagination
  isLoading: boolean
  error: string | null
  filters: BackofficeClientsFilters
  setFilters: (filters: BackofficeClientsFilters) => void
  fetchClients: (options?: {
    filters?: Partial<BackofficeClientsFilters>
    page?: number
    pageSize?: number
  }) => Promise<void>
  setClientsPage: (page: number) => Promise<void>
  setClientsPageSize: (pageSize: number) => Promise<void>
  clearFilters: () => Promise<void>
}

const BackofficeClientsContext = createContext<ClientsContextValue | undefined>(undefined)

interface Props {
  children: ReactNode
  clientsService: IBackofficeClientsService
}

export function BackofficeClientsProvider({ children, clientsService }: Props) {
  const [clients, setClients] = useState<BackofficeClientItem[]>([])
  const [pagination, setPagination] = useState<BackofficePagination>(DEFAULT_PAGINATION)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<BackofficeClientsFilters>(DEFAULT_FILTERS)
  const inFlight = useRef(false)

  const loadClients = useCallback(async (
    targetFilters: BackofficeClientsFilters,
    targetPage: number,
    targetPageSize: number
  ) => {
    if (inFlight.current) return
    inFlight.current = true
    setIsLoading(true)
    setError(null)
    try {
      const response = await clientsService.list({
        filters: targetFilters,
        page: targetPage,
        pageSize: targetPageSize,
      })

      setClients(response.items)
      setPagination(response.pagination)
      setFilters(targetFilters)
    } catch (err) {
      console.error("[BackofficeClientsContext]", err)
      setError("Erro ao carregar clientes")
      setClients([])
      setPagination((prev) => ({
        ...prev,
        page: targetPage,
        pageSize: targetPageSize,
      }))
    } finally {
      setIsLoading(false)
      inFlight.current = false
    }
  }, [clientsService])

  const fetchClients = useCallback(async (options?: {
    filters?: Partial<BackofficeClientsFilters>
    page?: number
    pageSize?: number
  }) => {
    const mergedFilters = {
      ...filters,
      ...(options?.filters ?? {}),
    }

    const page = Math.max(options?.page ?? pagination.page, 1)
    const pageSize = Math.max(options?.pageSize ?? pagination.pageSize, 5)

    await loadClients(mergedFilters, page, pageSize)
  }, [filters, loadClients, pagination.page, pagination.pageSize])

  const setClientsPage = useCallback(async (page: number) => {
    const nextPage = Math.max(page, 1)
    await loadClients(filters, nextPage, pagination.pageSize)
  }, [filters, loadClients, pagination.pageSize])

  const setClientsPageSize = useCallback(async (pageSize: number) => {
    const nextPageSize = Math.max(pageSize, 5)
    await loadClients(filters, 1, nextPageSize)
  }, [filters, loadClients])

  const clearFilters = useCallback(async () => {
    await loadClients(DEFAULT_FILTERS, 1, pagination.pageSize)
  }, [loadClients, pagination.pageSize])

  useEffect(() => {
    loadClients(DEFAULT_FILTERS, 1, DEFAULT_PAGINATION.pageSize)
  }, [loadClients])

  return (
    <BackofficeClientsContext.Provider
      value={{
        clients,
        pagination,
        isLoading,
        error,
        filters,
        setFilters,
        fetchClients,
        setClientsPage,
        setClientsPageSize,
        clearFilters,
      }}
    >
      {children}
    </BackofficeClientsContext.Provider>
  )
}

export function useBackofficeClients(): ClientsContextValue {
  const ctx = useContext(BackofficeClientsContext)
  if (!ctx) throw new Error("useBackofficeClients must be used within BackofficeClientsProvider")
  return ctx
}
