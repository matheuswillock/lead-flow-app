"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import type { VisibilityState } from "@tanstack/react-table"
import { toast } from "sonner"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import type { IBackofficeCrmService } from "../services/IBackofficeCrmService"
import {
  DEFAULT_BACKOFFICE_CRM_FILTERS,
  DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_ORDER,
  DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_VISIBILITY,
  type BackofficeCrmFiltersState,
  type BackofficeCrmUserOption,
  type BackofficeLeadCreateInput,
  type BackofficeLeadItem,
  type BackofficeLeadScheduleInput,
  type BackofficeLeadStatusKey,
  type BackofficeLeadUpdateInput,
  normalizeBackofficeCrmFilters,
} from "./BackofficeCrmTypes"

interface UpdateLeadStatusOptions {
  silent?: boolean
}

interface ContextValue {
  isLoading: boolean
  error: string | null
  canManage: boolean
  leads: BackofficeLeadItem[]
  filteredLeads: BackofficeLeadItem[]
  users: BackofficeCrmUserOption[]
  sdrOptions: BackofficeCrmUserOption[]
  closerOptions: BackofficeCrmUserOption[]
  filters: BackofficeCrmFiltersState
  selectedLead: BackofficeLeadItem | null
  isFormDialogOpen: boolean
  tableColumnVisibility: VisibilityState
  tableColumnOrder: string[]
  setFilter: <K extends keyof BackofficeCrmFiltersState>(
    key: K,
    value: BackofficeCrmFiltersState[K]
  ) => void
  setFilters: (filters: BackofficeCrmFiltersState) => void
  clearFilters: () => void
  setTableColumnVisibility: Dispatch<SetStateAction<VisibilityState>>
  setTableColumnOrder: Dispatch<SetStateAction<string[]>>
  openCreateDialog: () => void
  openEditDialog: (lead: BackofficeLeadItem) => void
  closeFormDialog: () => void
  refresh: () => Promise<void>
  createLead: (input: BackofficeLeadCreateInput) => Promise<BackofficeLeadItem>
  updateLead: (id: string, input: BackofficeLeadUpdateInput) => Promise<void>
  updateLeadStatus: (
    id: string,
    status: BackofficeLeadStatusKey,
    schedule?: BackofficeLeadScheduleInput,
    options?: UpdateLeadStatusOptions
  ) => Promise<void>
  removeLead: (id: string) => Promise<void>
}

const CRM_REQUEST_KEY = "backoffice-crm-data"
const ALLOWED_COLUMN_ORDER = new Set(DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_ORDER)

export const BackofficeCrmContext = createContext<ContextValue | undefined>(undefined)

interface ProviderProps {
  children: ReactNode
  service: IBackofficeCrmService
}

function normalizeColumnVisibility(raw: unknown): VisibilityState {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_VISIBILITY
  }

  const parsed = raw as Record<string, unknown>
  return Object.keys(DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_VISIBILITY).reduce(
    (acc, key) => {
      const value = parsed[key]
      acc[key] =
        typeof value === "boolean"
          ? value
          : DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_VISIBILITY[
              key as keyof typeof DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_VISIBILITY
            ]
      return acc
    },
    {} as VisibilityState
  )
}

function normalizeColumnOrder(raw: unknown): string[] {
  if (!Array.isArray(raw)) return DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_ORDER

  const saved = raw.filter(
    (value): value is string => typeof value === "string" && ALLOWED_COLUMN_ORDER.has(value)
  )
  const missing = DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_ORDER.filter(
    (columnId) => !saved.includes(columnId)
  )
  return [...saved, ...missing]
}

function leadMatchesFilters(
  lead: BackofficeLeadItem,
  filters: BackofficeCrmFiltersState
): boolean {
  const q = filters.query.trim().toLowerCase()
  const matchesQuery =
    !q ||
    lead.name.toLowerCase().includes(q) ||
    (lead.email ?? "").toLowerCase().includes(q) ||
    (lead.phone ?? "").toLowerCase().includes(q) ||
    (lead.cpfCnpj ?? "").toLowerCase().includes(q) ||
    (lead.notes ?? "").toLowerCase().includes(q)

  const matchesStatus =
    filters.statusFilter.length === 0 || filters.statusFilter.includes(lead.status)

  const matchesSdr =
    filters.sdrFilter.length === 0 ||
    (lead.sdrBackofficeUserId !== null &&
      filters.sdrFilter.includes(lead.sdrBackofficeUserId))

  const matchesCloser =
    filters.closerFilter.length === 0 ||
    (lead.closerBackofficeUserId !== null &&
      filters.closerFilter.includes(lead.closerBackofficeUserId))

  const createdDate = lead.createdAt.slice(0, 10)
  const matchesStart = !filters.periodStart || createdDate >= filters.periodStart
  const matchesEnd = !filters.periodEnd || createdDate <= filters.periodEnd

  return matchesQuery && matchesStatus && matchesSdr && matchesCloser && matchesStart && matchesEnd
}

export function BackofficeCrmProvider({ children, service }: ProviderProps) {
  const { user } = useBackofficeUser()
  const canManage = !user?.isOperator
  const [leads, setLeads] = useState<BackofficeLeadItem[]>([])
  const [users, setUsers] = useState<BackofficeCrmUserOption[]>([])
  const [filters, setFiltersState] = useState<BackofficeCrmFiltersState>(
    DEFAULT_BACKOFFICE_CRM_FILTERS
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<BackofficeLeadItem | null>(null)
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [tableColumnVisibility, setTableColumnVisibility] = useState<VisibilityState>(
    DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_VISIBILITY
  )
  const [tableColumnOrder, setTableColumnOrder] = useState<string[]>(
    DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_ORDER
  )

  const lastSuccessKeyRef = useRef<string | null>(null)
  const inFlightKeyRef = useRef<string | null>(null)
  const inFlightPromiseRef = useRef<Promise<void> | null>(null)
  const skipPersistFiltersRef = useRef(false)
  const skipPersistColumnVisibilityRef = useRef(false)
  const skipPersistColumnOrderRef = useRef(false)

  const storageScope = user?.profileId ?? null
  const filtersStorageKey = useMemo(
    () => (storageScope ? `backofficeCrmFilters:v1:${storageScope}` : null),
    [storageScope]
  )
  const columnVisibilityStorageKey = useMemo(
    () => (storageScope ? `backofficeCrmColumns:v1:${storageScope}` : null),
    [storageScope]
  )
  const columnOrderStorageKey = useMemo(
    () => (storageScope ? `backofficeCrmColumnOrder:v1:${storageScope}` : null),
    [storageScope]
  )

  const loadLeads = useCallback(
    async (options?: { force?: boolean }) => {
      if (!options?.force && inFlightKeyRef.current === CRM_REQUEST_KEY && inFlightPromiseRef.current) {
        return inFlightPromiseRef.current
      }

      if (!options?.force && lastSuccessKeyRef.current === CRM_REQUEST_KEY) {
        return
      }

      const requestPromise = (async () => {
        setIsLoading(true)
        setError(null)
        try {
          const [data, userOptions] = await Promise.all([
            service.list(),
            service.listUsers(),
          ])
          setLeads(data)
          setUsers(userOptions.filter((option) => option.isActive))
          lastSuccessKeyRef.current = CRM_REQUEST_KEY
        } catch (err) {
          console.error("[BackofficeCrmContext][loadLeads]", err)
          setError(err instanceof Error ? err.message : "Erro ao carregar dados do CRM")
        } finally {
          if (inFlightKeyRef.current === CRM_REQUEST_KEY) {
            inFlightKeyRef.current = null
            inFlightPromiseRef.current = null
          }
          setIsLoading(false)
        }
      })()

      inFlightKeyRef.current = CRM_REQUEST_KEY
      inFlightPromiseRef.current = requestPromise
      return requestPromise
    },
    [service]
  )

  useEffect(() => {
    void loadLeads()
  }, [loadLeads])

  useEffect(() => {
    skipPersistFiltersRef.current = true
    if (!filtersStorageKey || typeof window === "undefined") {
      setFiltersState(DEFAULT_BACKOFFICE_CRM_FILTERS)
      return
    }

    try {
      const raw = window.localStorage.getItem(filtersStorageKey)
      setFiltersState(raw ? normalizeBackofficeCrmFilters(JSON.parse(raw)) : DEFAULT_BACKOFFICE_CRM_FILTERS)
    } catch (err) {
      console.error("[BackofficeCrmContext][loadFilters]", err)
      setFiltersState(DEFAULT_BACKOFFICE_CRM_FILTERS)
    }
  }, [filtersStorageKey])

  useEffect(() => {
    if (!filtersStorageKey || typeof window === "undefined") return
    if (skipPersistFiltersRef.current) {
      skipPersistFiltersRef.current = false
      return
    }

    try {
      window.localStorage.setItem(filtersStorageKey, JSON.stringify(filters))
    } catch (err) {
      console.error("[BackofficeCrmContext][persistFilters]", err)
    }
  }, [filters, filtersStorageKey])

  useEffect(() => {
    skipPersistColumnVisibilityRef.current = true
    if (!columnVisibilityStorageKey || typeof window === "undefined") {
      setTableColumnVisibility(DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_VISIBILITY)
      return
    }

    try {
      const raw = window.localStorage.getItem(columnVisibilityStorageKey)
      setTableColumnVisibility(
        raw
          ? normalizeColumnVisibility(JSON.parse(raw))
          : DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_VISIBILITY
      )
    } catch (err) {
      console.error("[BackofficeCrmContext][loadColumnVisibility]", err)
      setTableColumnVisibility(DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_VISIBILITY)
    }
  }, [columnVisibilityStorageKey])

  useEffect(() => {
    if (!columnVisibilityStorageKey || typeof window === "undefined") return
    if (skipPersistColumnVisibilityRef.current) {
      skipPersistColumnVisibilityRef.current = false
      return
    }

    try {
      window.localStorage.setItem(
        columnVisibilityStorageKey,
        JSON.stringify(tableColumnVisibility)
      )
    } catch (err) {
      console.error("[BackofficeCrmContext][persistColumnVisibility]", err)
    }
  }, [columnVisibilityStorageKey, tableColumnVisibility])

  useEffect(() => {
    skipPersistColumnOrderRef.current = true
    if (!columnOrderStorageKey || typeof window === "undefined") {
      setTableColumnOrder(DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_ORDER)
      return
    }

    try {
      const raw = window.localStorage.getItem(columnOrderStorageKey)
      setTableColumnOrder(
        raw ? normalizeColumnOrder(JSON.parse(raw)) : DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_ORDER
      )
    } catch (err) {
      console.error("[BackofficeCrmContext][loadColumnOrder]", err)
      setTableColumnOrder(DEFAULT_BACKOFFICE_CRM_TABLE_COLUMN_ORDER)
    }
  }, [columnOrderStorageKey])

  useEffect(() => {
    if (!columnOrderStorageKey || typeof window === "undefined") return
    if (skipPersistColumnOrderRef.current) {
      skipPersistColumnOrderRef.current = false
      return
    }

    try {
      window.localStorage.setItem(columnOrderStorageKey, JSON.stringify(tableColumnOrder))
    } catch (err) {
      console.error("[BackofficeCrmContext][persistColumnOrder]", err)
    }
  }, [columnOrderStorageKey, tableColumnOrder])

  const filteredLeads = useMemo(
    () => leads.filter((lead) => leadMatchesFilters(lead, filters)),
    [filters, leads]
  )

  const sdrOptions = useMemo(
    () => users.filter((option) => option.isSdr),
    [users]
  )

  const closerOptions = useMemo(
    () => users.filter((option) => option.isCloser),
    [users]
  )

  const setFilters = useCallback((nextFilters: BackofficeCrmFiltersState) => {
    setFiltersState(normalizeBackofficeCrmFilters(nextFilters))
  }, [])

  const setFilter = useCallback(
    <K extends keyof BackofficeCrmFiltersState>(
      key: K,
      value: BackofficeCrmFiltersState[K]
    ) => {
      setFiltersState((prev) => normalizeBackofficeCrmFilters({ ...prev, [key]: value }))
    },
    []
  )

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_BACKOFFICE_CRM_FILTERS)
  }, [setFilters])

  const openCreateDialog = useCallback(() => {
    setSelectedLead(null)
    setIsFormDialogOpen(true)
  }, [])

  const openEditDialog = useCallback((lead: BackofficeLeadItem) => {
    setSelectedLead(lead)
    setIsFormDialogOpen(true)
  }, [])

  const closeFormDialog = useCallback(() => {
    setIsFormDialogOpen(false)
    setSelectedLead(null)
  }, [])

  const createLead = useCallback(
    async (input: BackofficeLeadCreateInput): Promise<BackofficeLeadItem> => {
      const created = await service.create(input)
      setLeads((prev) => [created, ...prev])
      toast.success("Lead criado")
      return created
    },
    [service]
  )

  const updateLead = useCallback(
    async (id: string, input: BackofficeLeadUpdateInput) => {
      const updated = await service.update(id, input)
      setLeads((prev) => prev.map((lead) => (lead.id === id ? updated : lead)))
      setSelectedLead((prev) => (prev?.id === id ? updated : prev))
      toast.success("Lead atualizado")
    },
    [service]
  )

  const updateLeadStatus = useCallback(
    async (
      id: string,
      status: BackofficeLeadStatusKey,
      schedule?: BackofficeLeadScheduleInput,
      options?: UpdateLeadStatusOptions
    ) => {
      const updated = await service.updateStatus(id, status, schedule)
      setLeads((prev) => prev.map((lead) => (lead.id === id ? updated : lead)))
      setSelectedLead((prev) => (prev?.id === id ? updated : prev))
      if (!options?.silent) {
        toast.success("Status atualizado")
      }
    },
    [service]
  )

  const removeLead = useCallback(
    async (id: string) => {
      await service.remove(id)
      setLeads((prev) => prev.filter((lead) => lead.id !== id))
      setSelectedLead((prev) => (prev?.id === id ? null : prev))
      toast.success("Lead removido")
    },
    [service]
  )

  const refresh = useCallback(() => loadLeads({ force: true }), [loadLeads])

  const value = useMemo<ContextValue>(
    () => ({
      isLoading,
      error,
      canManage,
      leads,
      filteredLeads,
      users,
      sdrOptions,
      closerOptions,
      filters,
      selectedLead,
      isFormDialogOpen,
      tableColumnVisibility,
      tableColumnOrder,
      setFilter,
      setFilters,
      clearFilters,
      setTableColumnVisibility,
      setTableColumnOrder,
      openCreateDialog,
      openEditDialog,
      closeFormDialog,
      refresh,
      createLead,
      updateLead,
      updateLeadStatus,
      removeLead,
    }),
    [
      isLoading,
      error,
      canManage,
      leads,
      filteredLeads,
      users,
      sdrOptions,
      closerOptions,
      filters,
      selectedLead,
      isFormDialogOpen,
      tableColumnVisibility,
      tableColumnOrder,
      setFilter,
      setFilters,
      clearFilters,
      openCreateDialog,
      openEditDialog,
      closeFormDialog,
      refresh,
      createLead,
      updateLead,
      updateLeadStatus,
      removeLead,
    ]
  )

  return (
    <BackofficeCrmContext.Provider value={value}>{children}</BackofficeCrmContext.Provider>
  )
}
