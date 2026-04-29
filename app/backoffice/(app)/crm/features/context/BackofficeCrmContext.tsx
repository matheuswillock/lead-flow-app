"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import type { IBackofficeCrmService } from "../services/IBackofficeCrmService"
import {
  BACKOFFICE_CRM_COLUMNS,
  type BackofficeLeadCreateInput,
  type BackofficeLeadItem,
  type BackofficeLeadStatusKey,
  type BackofficeLeadUpdateInput,
} from "./BackofficeCrmTypes"

type LeadsByColumn = Record<BackofficeLeadStatusKey, BackofficeLeadItem[]>

function emptyLeadsByColumn(): LeadsByColumn {
  return BACKOFFICE_CRM_COLUMNS.reduce((acc, col) => {
    acc[col.key] = []
    return acc
  }, {} as LeadsByColumn)
}

function groupByStatus(leads: BackofficeLeadItem[]): LeadsByColumn {
  const grouped = emptyLeadsByColumn()
  for (const lead of leads) {
    if (grouped[lead.status]) {
      grouped[lead.status].push(lead)
    }
  }
  return grouped
}

interface ContextValue {
  isLoading: boolean
  error: string | null
  leadsByColumn: LeadsByColumn
  selectedLead: BackofficeLeadItem | null
  isFormDialogOpen: boolean
  openCreateDialog: () => void
  openEditDialog: (lead: BackofficeLeadItem) => void
  closeFormDialog: () => void
  refresh: () => Promise<void>
  createLead: (input: BackofficeLeadCreateInput) => Promise<void>
  updateLead: (id: string, input: BackofficeLeadUpdateInput) => Promise<void>
  removeLead: (id: string) => Promise<void>
  moveLead: (
    id: string,
    from: BackofficeLeadStatusKey,
    to: BackofficeLeadStatusKey
  ) => Promise<void>
}

export const BackofficeCrmContext = createContext<ContextValue | undefined>(undefined)

interface ProviderProps {
  children: ReactNode
  service: IBackofficeCrmService
}

export function BackofficeCrmProvider({ children, service }: ProviderProps) {
  const [leadsByColumn, setLeadsByColumn] = useState<LeadsByColumn>(emptyLeadsByColumn)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<BackofficeLeadItem | null>(null)
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const inFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsLoading(true)
    setError(null)
    try {
      const leads = await service.list()
      setLeadsByColumn(groupByStatus(leads))
    } catch (err) {
      console.error("[BackofficeCrmContext][refresh]", err)
      setError(err instanceof Error ? err.message : "Erro ao carregar leads")
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [service])

  useEffect(() => {
    void refresh()
  }, [refresh])

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
    async (input: BackofficeLeadCreateInput) => {
      const created = await service.create(input)
      setLeadsByColumn((prev) => ({
        ...prev,
        [created.status]: [created, ...(prev[created.status] ?? [])],
      }))
      toast.success("Lead criado")
    },
    [service]
  )

  const updateLead = useCallback(
    async (id: string, input: BackofficeLeadUpdateInput) => {
      const updated = await service.update(id, input)
      setLeadsByColumn((prev) => {
        const next = { ...prev }
        for (const col of BACKOFFICE_CRM_COLUMNS) {
          next[col.key] = (prev[col.key] ?? []).map((lead) =>
            lead.id === id ? updated : lead
          )
        }
        return next
      })
      toast.success("Lead atualizado")
    },
    [service]
  )

  const removeLead = useCallback(
    async (id: string) => {
      await service.remove(id)
      setLeadsByColumn((prev) => {
        const next = { ...prev }
        for (const col of BACKOFFICE_CRM_COLUMNS) {
          next[col.key] = (prev[col.key] ?? []).filter((lead) => lead.id !== id)
        }
        return next
      })
      toast.success("Lead removido")
    },
    [service]
  )

  const moveLead = useCallback(
    async (id: string, from: BackofficeLeadStatusKey, to: BackofficeLeadStatusKey) => {
      if (from === to) return

      const fromArr = leadsByColumn[from] ?? []
      const moving = fromArr.find((lead) => lead.id === id)
      if (!moving) return

      // Optimistic move
      setLeadsByColumn((prev) => {
        const next = { ...prev }
        next[from] = (prev[from] ?? []).filter((lead) => lead.id !== id)
        next[to] = [{ ...moving, status: to }, ...(prev[to] ?? [])]
        return next
      })

      try {
        const updated = await service.updateStatus(id, to)
        setLeadsByColumn((prev) => ({
          ...prev,
          [to]: (prev[to] ?? []).map((lead) => (lead.id === id ? updated : lead)),
        }))
      } catch (err) {
        console.error("[BackofficeCrmContext][moveLead]", err)
        toast.error(
          err instanceof Error ? err.message : "Erro ao mover lead. Recarregando..."
        )
        await refresh()
      }
    },
    [leadsByColumn, refresh, service]
  )

  const value = useMemo<ContextValue>(
    () => ({
      isLoading,
      error,
      leadsByColumn,
      selectedLead,
      isFormDialogOpen,
      openCreateDialog,
      openEditDialog,
      closeFormDialog,
      refresh,
      createLead,
      updateLead,
      removeLead,
      moveLead,
    }),
    [
      isLoading,
      error,
      leadsByColumn,
      selectedLead,
      isFormDialogOpen,
      openCreateDialog,
      openEditDialog,
      closeFormDialog,
      refresh,
      createLead,
      updateLead,
      removeLead,
      moveLead,
    ]
  )

  return (
    <BackofficeCrmContext.Provider value={value}>{children}</BackofficeCrmContext.Provider>
  )
}
