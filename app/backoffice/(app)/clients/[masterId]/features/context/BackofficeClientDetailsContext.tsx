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
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"
import type {
  BackofficeClientInvoice,
  BackofficeClientInvoiceFilters,
  BackofficeClientDetails,
  BackofficeClientDetailsFilters,
  BackofficePagination,
} from "./BackofficeClientDetailsTypes"

const DEFAULT_FILTERS: BackofficeClientDetailsFilters = {
  query: "",
}

const DEFAULT_TEAMS_PAGINATION: BackofficePagination = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}

const DEFAULT_INVOICES_PAGINATION: BackofficePagination = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}

const DEFAULT_INVOICE_FILTERS: BackofficeClientInvoiceFilters = {
  status: "all",
  period: "all",
}

type ClientDetailsSection = "teams" | "invoices"

interface BackofficeClientDetailsContextValue {
  details: BackofficeClientDetails | null
  teams: BackofficeClientDetails["teams"]
  teamsPagination: BackofficePagination
  invoices: BackofficeClientInvoice[]
  invoicesPagination: BackofficePagination
  invoiceFilters: BackofficeClientInvoiceFilters
  invoicesSummary: {
    charged: number
    upcoming: number
    overdue: number
  }
  isLoading: boolean
  isTeamsLoading: boolean
  isInvoicesLoading: boolean
  error: string | null
  teamsError: string | null
  invoicesError: string | null
  activeSection: ClientDetailsSection
  setActiveSection: (section: ClientDetailsSection) => void
  filters: BackofficeClientDetailsFilters
  setFilters: (filters: BackofficeClientDetailsFilters) => void
  fetchDetails: (options?: {
    filters?: Partial<BackofficeClientDetailsFilters>
    page?: number
    pageSize?: number
  }) => Promise<void>
  setTeamsPage: (page: number) => Promise<void>
  setTeamsPageSize: (pageSize: number) => Promise<void>
  fetchInvoices: (options?: {
    page?: number
    pageSize?: number
    filters?: Partial<BackofficeClientInvoiceFilters>
  }) => Promise<void>
  setInvoicesPage: (page: number) => Promise<void>
  setInvoicesFilters: (filters: Partial<BackofficeClientInvoiceFilters>) => Promise<void>
  reload: () => Promise<void>
  clearFilters: () => Promise<void>
}

const BackofficeClientDetailsContext = createContext<BackofficeClientDetailsContextValue | undefined>(
  undefined
)

interface Props {
  children: ReactNode
  masterId: string
  service: IBackofficeClientDetailsService
}

export function BackofficeClientDetailsProvider({ children, masterId, service }: Props) {
  const [details, setDetails] = useState<BackofficeClientDetails | null>(null)
  const [teamsPagination, setTeamsPagination] = useState<BackofficePagination>(
    DEFAULT_TEAMS_PAGINATION
  )
  const [invoices, setInvoices] = useState<BackofficeClientInvoice[]>([])
  const [invoicesPagination, setInvoicesPagination] = useState<BackofficePagination>(
    DEFAULT_INVOICES_PAGINATION
  )
  const [invoiceFilters, setInvoiceFilters] = useState<BackofficeClientInvoiceFilters>(
    DEFAULT_INVOICE_FILTERS
  )
  const [invoicesSummary, setInvoicesSummary] = useState({
    charged: 0,
    upcoming: 0,
    overdue: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isTeamsLoading, setIsTeamsLoading] = useState(false)
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [teamsError, setTeamsError] = useState<string | null>(null)
  const [invoicesError, setInvoicesError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<ClientDetailsSection>("teams")
  const [filters, setFilters] = useState<BackofficeClientDetailsFilters>(DEFAULT_FILTERS)
  const inFlight = useRef(false)
  const invoicesInFlight = useRef(false)
  const hasLoadedDetails = useRef(false)

  const loadDetails = useCallback(async (
    targetFilters: BackofficeClientDetailsFilters,
    targetPage: number,
    targetPageSize: number
  ) => {
    if (inFlight.current) {
      return
    }

    const isInitialLoad = !hasLoadedDetails.current
    inFlight.current = true

    if (isInitialLoad) {
      setIsLoading(true)
      setError(null)
    } else {
      setIsTeamsLoading(true)
      setTeamsError(null)
    }

    try {
      const data = await service.getByMasterId(masterId, {
        query: targetFilters.query.trim() || undefined,
        page: targetPage,
        pageSize: targetPageSize,
      })

      setDetails(data)
      setFilters(targetFilters)
      setTeamsPagination(data.teamsPagination)
      hasLoadedDetails.current = true
    } catch (err) {
      console.error("[BackofficeClientDetailsContext]", err)

      if (isInitialLoad) {
        setError("Erro ao carregar detalhes do usuário")
        setDetails(null)
      } else {
        setTeamsError("Erro ao atualizar tabela de times")
      }

      setTeamsPagination((prev) => ({
        ...prev,
        page: targetPage,
        pageSize: targetPageSize,
      }))
    } finally {
      if (isInitialLoad) {
        setIsLoading(false)
      }

      setIsTeamsLoading(false)
      inFlight.current = false
    }
  }, [masterId, service])

  const loadInvoices = useCallback(async (
    targetPage: number,
    targetPageSize: number,
    targetFilters: BackofficeClientInvoiceFilters
  ) => {
    if (invoicesInFlight.current) {
      return
    }

    invoicesInFlight.current = true
    setIsInvoicesLoading(true)
    setInvoicesError(null)

    try {
      const result = await service.getInvoicesByMasterId(masterId, {
        page: targetPage,
        pageSize: targetPageSize,
        status: targetFilters.status,
        period: targetFilters.period,
      })

      setInvoices(result.items)
      setInvoicesPagination(result.pagination)
      setInvoiceFilters(result.filters)
      setInvoicesSummary(result.summary)
    } catch (err) {
      console.error("[BackofficeClientDetailsContext][invoices]", err)
      setInvoicesError("Erro ao carregar faturas do cliente")
      setInvoices([])
      setInvoicesSummary({ charged: 0, upcoming: 0, overdue: 0 })
      setInvoicesPagination((prev) => ({
        ...prev,
        page: targetPage,
        pageSize: targetPageSize,
      }))
    } finally {
      setIsInvoicesLoading(false)
      invoicesInFlight.current = false
    }
  }, [masterId, service])

  const fetchDetails = useCallback(async (options?: {
    filters?: Partial<BackofficeClientDetailsFilters>
    page?: number
    pageSize?: number
  }) => {
    const mergedFilters = {
      ...filters,
      ...(options?.filters ?? {}),
    }

    const page = Math.max(options?.page ?? teamsPagination.page, 1)
    const pageSize = Math.max(options?.pageSize ?? teamsPagination.pageSize, 5)

    await loadDetails(mergedFilters, page, pageSize)
  }, [filters, loadDetails, teamsPagination.page, teamsPagination.pageSize])

  const setTeamsPage = useCallback(async (page: number) => {
    const nextPage = Math.max(page, 1)
    await loadDetails(filters, nextPage, teamsPagination.pageSize)
  }, [filters, loadDetails, teamsPagination.pageSize])

  const setTeamsPageSize = useCallback(async (pageSize: number) => {
    const nextPageSize = Math.max(pageSize, 5)
    await loadDetails(filters, 1, nextPageSize)
  }, [filters, loadDetails])

  const fetchInvoices = useCallback(async (options?: {
    page?: number
    pageSize?: number
    filters?: Partial<BackofficeClientInvoiceFilters>
  }) => {
    const page = Math.max(options?.page ?? invoicesPagination.page, 1)
    const pageSize = Math.max(options?.pageSize ?? invoicesPagination.pageSize, 5)
    const mergedFilters: BackofficeClientInvoiceFilters = {
      ...invoiceFilters,
      ...(options?.filters ?? {}),
    }

    await loadInvoices(page, pageSize, mergedFilters)
  }, [invoiceFilters, invoicesPagination.page, invoicesPagination.pageSize, loadInvoices])

  const setInvoicesPage = useCallback(async (page: number) => {
    const nextPage = Math.max(page, 1)
    await loadInvoices(nextPage, invoicesPagination.pageSize, invoiceFilters)
  }, [invoiceFilters, invoicesPagination.pageSize, loadInvoices])

  const setInvoicesFilters = useCallback(async (
    nextFilters: Partial<BackofficeClientInvoiceFilters>
  ) => {
    const mergedFilters: BackofficeClientInvoiceFilters = {
      ...invoiceFilters,
      ...nextFilters,
    }

    await loadInvoices(1, invoicesPagination.pageSize, mergedFilters)
  }, [invoiceFilters, invoicesPagination.pageSize, loadInvoices])

  const reload = useCallback(async () => {
    await Promise.all([
      loadDetails(filters, teamsPagination.page, teamsPagination.pageSize),
      loadInvoices(invoicesPagination.page, invoicesPagination.pageSize, invoiceFilters),
    ])
  }, [
    filters,
    invoiceFilters,
    invoicesPagination.page,
    invoicesPagination.pageSize,
    loadDetails,
    loadInvoices,
    teamsPagination.page,
    teamsPagination.pageSize,
  ])

  const clearFilters = useCallback(async () => {
    await loadDetails(DEFAULT_FILTERS, 1, teamsPagination.pageSize)
  }, [loadDetails, teamsPagination.pageSize])

  useEffect(() => {
    void Promise.all([
      loadDetails(DEFAULT_FILTERS, 1, DEFAULT_TEAMS_PAGINATION.pageSize),
      loadInvoices(1, DEFAULT_INVOICES_PAGINATION.pageSize, DEFAULT_INVOICE_FILTERS),
    ])
  }, [loadDetails, loadInvoices])

  const teams = details?.teams ?? []

  return (
    <BackofficeClientDetailsContext.Provider
      value={{
        details,
        teams,
        teamsPagination,
        invoices,
        invoicesPagination,
        invoiceFilters,
        invoicesSummary,
        isLoading,
        isTeamsLoading,
        isInvoicesLoading,
        error,
        teamsError,
        invoicesError,
        activeSection,
        setActiveSection,
        filters,
        setFilters,
        fetchDetails,
        setTeamsPage,
        setTeamsPageSize,
        fetchInvoices,
        setInvoicesPage,
        setInvoicesFilters,
        reload,
        clearFilters,
      }}
    >
      {children}
    </BackofficeClientDetailsContext.Provider>
  )
}

export function useBackofficeClientDetails() {
  const context = useContext(BackofficeClientDetailsContext)
  if (!context) {
    throw new Error("useBackofficeClientDetails must be used within BackofficeClientDetailsProvider")
  }
  return context
}
