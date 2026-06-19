"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { IBackofficeAdhesionsService } from "../services/IBackofficeAdhesionsService"
import type {
  BackofficeAdhesionFilters,
  BackofficeAdhesionItem,
  BackofficeAdhesionPagination,
} from "./BackofficeAdhesionsTypes"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"

const DEFAULT_FILTERS: BackofficeAdhesionFilters = {
  query: "",
  status: "all",
}

const DEFAULT_PAGINATION: BackofficeAdhesionPagination = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}

interface BackofficeAdhesionsContextValue {
  adhesions: BackofficeAdhesionItem[]
  pagination: BackofficeAdhesionPagination
  filters: BackofficeAdhesionFilters
  isLoading: boolean
  error: string | null
  canManage: boolean
  service: IBackofficeAdhesionsService
  setFilters: (filters: BackofficeAdhesionFilters) => void
  fetchAdhesions: (options?: {
    filters?: Partial<BackofficeAdhesionFilters>
    page?: number
    pageSize?: number
  }) => Promise<void>
  setAdhesionsPage: (page: number) => Promise<void>
  setAdhesionsPageSize: (pageSize: number) => Promise<void>
  clearFilters: () => Promise<void>
}

const BackofficeAdhesionsContext =
  createContext<BackofficeAdhesionsContextValue | null>(null)

interface BackofficeAdhesionsProviderProps {
  children: ReactNode
  service: IBackofficeAdhesionsService
}

export function BackofficeAdhesionsProvider({
  children,
  service,
}: BackofficeAdhesionsProviderProps) {
  const { user } = useBackofficeUser()
  const canManage = !user?.isOperator
  const [adhesions, setAdhesions] = useState<BackofficeAdhesionItem[]>([])
  const [pagination, setPagination] =
    useState<BackofficeAdhesionPagination>(DEFAULT_PAGINATION)
  const [filters, setFilters] = useState<BackofficeAdhesionFilters>(DEFAULT_FILTERS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlightKey = useRef<string | null>(null)
  const lastSuccessKey = useRef<string | null>(null)

  const loadAdhesions = useCallback(
    async (
      targetFilters: BackofficeAdhesionFilters,
      targetPage: number,
      targetPageSize: number
    ) => {
      const requestKey = JSON.stringify({
        filters: targetFilters,
        page: targetPage,
        pageSize: targetPageSize,
      })
      if (inFlightKey.current === requestKey || lastSuccessKey.current === requestKey) return

      inFlightKey.current = requestKey
      setIsLoading(true)
      setError(null)

      try {
        const response = await service.list({
          filters: targetFilters,
          page: targetPage,
          pageSize: targetPageSize,
        })
        setAdhesions(response.items)
        setPagination(response.pagination)
        setFilters(targetFilters)
        lastSuccessKey.current = requestKey
      } catch (err) {
        console.error("[BackofficeAdhesionsContext]", err)
        setError(err instanceof Error ? err.message : "Erro ao carregar adesões")
      } finally {
        inFlightKey.current = null
        setIsLoading(false)
      }
    },
    [service]
  )

  const fetchAdhesions = useCallback(
    async (options?: {
      filters?: Partial<BackofficeAdhesionFilters>
      page?: number
      pageSize?: number
    }) => {
      const mergedFilters = { ...filters, ...(options?.filters ?? {}) }
      lastSuccessKey.current = null
      await loadAdhesions(
        mergedFilters,
        Math.max(options?.page ?? pagination.page, 1),
        Math.max(options?.pageSize ?? pagination.pageSize, 5)
      )
    },
    [filters, loadAdhesions, pagination.page, pagination.pageSize]
  )

  const setAdhesionsPage = useCallback(
    async (page: number) => {
      await loadAdhesions(filters, Math.max(page, 1), pagination.pageSize)
    },
    [filters, loadAdhesions, pagination.pageSize]
  )

  const setAdhesionsPageSize = useCallback(
    async (pageSize: number) => {
      await loadAdhesions(filters, 1, Math.max(pageSize, 5))
    },
    [filters, loadAdhesions]
  )

  const clearFilters = useCallback(async () => {
    lastSuccessKey.current = null
    await loadAdhesions(DEFAULT_FILTERS, 1, pagination.pageSize)
  }, [loadAdhesions, pagination.pageSize])

  useEffect(() => {
    void loadAdhesions(DEFAULT_FILTERS, 1, DEFAULT_PAGINATION.pageSize)
  }, [loadAdhesions])

  return (
    <BackofficeAdhesionsContext.Provider
      value={{
        adhesions,
        pagination,
        filters,
        isLoading,
        error,
        canManage,
        service,
        setFilters,
        fetchAdhesions,
        setAdhesionsPage,
        setAdhesionsPageSize,
        clearFilters,
      }}
    >
      {children}
    </BackofficeAdhesionsContext.Provider>
  )
}

export function useBackofficeAdhesionsContext(): BackofficeAdhesionsContextValue {
  const context = useContext(BackofficeAdhesionsContext)
  if (!context) {
    throw new Error(
      "useBackofficeAdhesionsContext must be used within BackofficeAdhesionsProvider"
    )
  }
  return context
}
