"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import type { IBackofficeWhatsAppInstancesService } from "../services/IBackofficeWhatsAppInstancesService"
import type {
  BackofficeWhatsAppInstanceDetail,
  BackofficeWhatsAppInstanceListItem,
  BackofficeWhatsAppInstancesFilters,
  BackofficeWhatsAppInstancesPagination,
  BackofficeWhatsAppTeamWithoutInstance,
  ProvisionWhatsAppInstanceFormData,
  UpdateWhatsAppInstanceFormData,
  BackofficeWhatsAppWebhookResyncResult,
} from "./BackofficeWhatsAppInstancesTypes"

const DEFAULT_FILTERS: BackofficeWhatsAppInstancesFilters = {
  q: "",
  status: "all",
}

const DEFAULT_PAGINATION: BackofficeWhatsAppInstancesPagination = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}

interface BackofficeWhatsAppInstancesContextValue {
  instances: BackofficeWhatsAppInstanceListItem[]
  pagination: BackofficeWhatsAppInstancesPagination
  filters: BackofficeWhatsAppInstancesFilters
  selectedDetail: BackofficeWhatsAppInstanceDetail | null
  eligibleTeams: BackofficeWhatsAppTeamWithoutInstance[]
  isLoading: boolean
  isLoadingDetail: boolean
  isLoadingTeams: boolean
  isSaving: boolean
  isReconnecting: boolean
  isDisconnecting: boolean
  isSyncing: boolean
  isProvisioning: boolean
  isResyncingWebhooks: boolean
  webhookResyncResult: BackofficeWhatsAppWebhookResyncResult | null
  canManage: boolean
  error: string | null
  selectedConfigId: string | null
  isProvisionOpen: boolean
  setFilters: (filters: BackofficeWhatsAppInstancesFilters) => void
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  openDetail: (configId: string) => Promise<void>
  closeDetail: () => void
  refreshList: () => Promise<void>
  updateInstance: (
    configId: string,
    data: UpdateWhatsAppInstanceFormData
  ) => Promise<{ isValid: boolean; errorMessages: string[] }>
  reconnectInstance: (configId: string) => Promise<{ isValid: boolean; errorMessages: string[] }>
  disconnectInstance: (configId: string) => Promise<{ isValid: boolean; errorMessages: string[] }>
  syncHistory: (configId: string) => Promise<{ isValid: boolean; errorMessages: string[] }>
  openProvision: () => void
  closeProvision: () => void
  loadEligibleTeams: (q?: string) => Promise<void>
  provisionInstance: (
    data: ProvisionWhatsAppInstanceFormData
  ) => Promise<{ isValid: boolean; errorMessages: string[] }>
  previewResyncWebhooks: () => Promise<void>
  confirmResyncWebhooks: () => Promise<{ isValid: boolean; errorMessages: string[] }>
}

export const BackofficeWhatsAppInstancesContext = createContext<
  BackofficeWhatsAppInstancesContextValue | undefined
>(undefined)

interface Props {
  children: ReactNode
  instancesService: IBackofficeWhatsAppInstancesService
}

export function BackofficeWhatsAppInstancesProvider({ children, instancesService }: Props) {
  const { user } = useBackofficeUser()
  const canManage = !user?.isOperator

  const [instances, setInstances] = useState<BackofficeWhatsAppInstanceListItem[]>([])
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION)
  const [filters, setFiltersState] = useState(DEFAULT_FILTERS)
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(10)
  const [selectedDetail, setSelectedDetail] = useState<BackofficeWhatsAppInstanceDetail | null>(null)
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [eligibleTeams, setEligibleTeams] = useState<BackofficeWhatsAppTeamWithoutInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [isResyncingWebhooks, setIsResyncingWebhooks] = useState(false)
  const [webhookResyncResult, setWebhookResyncResult] =
    useState<BackofficeWhatsAppWebhookResyncResult | null>(null)
  const [isProvisionOpen, setIsProvisionOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listInFlight = useRef(false)
  const lastListKey = useRef<string | null>(null)

  const buildListKey = useCallback(
    () => JSON.stringify({ filters, page, pageSize }),
    [filters, page, pageSize]
  )

  const refreshList = useCallback(async () => {
    const key = buildListKey()
    if (listInFlight.current && lastListKey.current === key) return
    listInFlight.current = true
    lastListKey.current = key
    setIsLoading(true)
    setError(null)
    try {
      const result = await instancesService.list(filters, { page, pageSize })
      setInstances(result.items)
      setPagination(result.pagination)
    } catch (err) {
      console.error("[BackofficeWhatsAppInstancesContext][refreshList]", err)
      setError(err instanceof Error ? err.message : "Erro ao carregar instâncias")
    } finally {
      setIsLoading(false)
      listInFlight.current = false
    }
  }, [buildListKey, filters, instancesService, page, pageSize])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  const setFilters = useCallback((next: BackofficeWhatsAppInstancesFilters) => {
    setFiltersState(next)
    setPageState(1)
  }, [])

  const setPage = useCallback((next: number) => {
    setPageState(next)
  }, [])

  const setPageSize = useCallback((next: number) => {
    setPageSizeState(next)
    setPageState(1)
  }, [])

  const openDetail = useCallback(
    async (configId: string) => {
      setSelectedConfigId(configId)
      setIsLoadingDetail(true)
      setError(null)
      try {
        const detail = await instancesService.getDetail(configId)
        setSelectedDetail(detail)
      } catch (err) {
        console.error("[BackofficeWhatsAppInstancesContext][openDetail]", err)
        setError(err instanceof Error ? err.message : "Erro ao carregar detalhe")
        setSelectedConfigId(null)
      } finally {
        setIsLoadingDetail(false)
      }
    },
    [instancesService]
  )

  const closeDetail = useCallback(() => {
    setSelectedConfigId(null)
    setSelectedDetail(null)
  }, [])

  const applyDetailResult = useCallback(
    (detail: BackofficeWhatsAppInstanceDetail) => {
      setSelectedDetail(detail)
      setInstances((prev) =>
        prev.map((item) =>
          item.id === detail.id
            ? {
                ...item,
                status: detail.status,
                phoneNumber: detail.phoneNumber,
                displayName: detail.displayName,
                lastConnectedAt: detail.lastConnectedAt,
                lastDisconnectedAt: detail.lastDisconnectedAt,
                lastSyncAt: detail.lastSyncAt,
                historySyncStatus: detail.historySyncStatus,
                usageLimitMonthly: detail.usageLimitMonthly,
                billingEnabled: detail.billingEnabled,
                updatedAt: detail.updatedAt,
              }
            : item
        )
      )
    },
    []
  )

  const updateInstance = useCallback(
    async (configId: string, data: UpdateWhatsAppInstanceFormData) => {
      setIsSaving(true)
      try {
        const result = await instancesService.update(configId, data)
        if (result.isValid && result.result) {
          applyDetailResult(result.result)
          toast.success(result.successMessages?.[0] ?? "Instância atualizada")
        } else {
          toast.error(result.errorMessages?.[0] ?? "Erro ao atualizar instância")
        }
        return { isValid: result.isValid, errorMessages: result.errorMessages ?? [] }
      } catch (err) {
        console.error("[BackofficeWhatsAppInstancesContext][updateInstance]", err)
        const message = err instanceof Error ? err.message : "Erro ao atualizar instância"
        toast.error(message)
        return { isValid: false, errorMessages: [message] }
      } finally {
        setIsSaving(false)
      }
    },
    [applyDetailResult, instancesService]
  )

  const reconnectInstance = useCallback(
    async (configId: string) => {
      setIsReconnecting(true)
      try {
        const result = await instancesService.reconnect(configId)
        if (result.isValid && result.result) {
          applyDetailResult(result.result)
          toast.success(result.successMessages?.[0] ?? "Reconexão iniciada")
        } else {
          toast.error(result.errorMessages?.[0] ?? "Erro ao reconectar")
        }
        return { isValid: result.isValid, errorMessages: result.errorMessages ?? [] }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao reconectar"
        toast.error(message)
        return { isValid: false, errorMessages: [message] }
      } finally {
        setIsReconnecting(false)
      }
    },
    [applyDetailResult, instancesService]
  )

  const disconnectInstance = useCallback(
    async (configId: string) => {
      setIsDisconnecting(true)
      try {
        const result = await instancesService.disconnect(configId)
        if (result.isValid && result.result) {
          applyDetailResult(result.result)
          toast.success(result.successMessages?.[0] ?? "Instância desconectada")
        } else {
          toast.error(result.errorMessages?.[0] ?? "Erro ao desconectar")
        }
        return { isValid: result.isValid, errorMessages: result.errorMessages ?? [] }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao desconectar"
        toast.error(message)
        return { isValid: false, errorMessages: [message] }
      } finally {
        setIsDisconnecting(false)
      }
    },
    [applyDetailResult, instancesService]
  )

  const syncHistory = useCallback(
    async (configId: string) => {
      setIsSyncing(true)
      try {
        const result = await instancesService.syncHistory(configId)
        if (result.isValid && result.result) {
          applyDetailResult(result.result)
          toast.success(result.successMessages?.[0] ?? "Histórico sincronizado")
        } else {
          toast.error(result.errorMessages?.[0] ?? "Erro ao sincronizar histórico")
        }
        return { isValid: result.isValid, errorMessages: result.errorMessages ?? [] }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao sincronizar histórico"
        toast.error(message)
        return { isValid: false, errorMessages: [message] }
      } finally {
        setIsSyncing(false)
      }
    },
    [applyDetailResult, instancesService]
  )

  const openProvision = useCallback(() => {
    setIsProvisionOpen(true)
  }, [])

  const closeProvision = useCallback(() => {
    setIsProvisionOpen(false)
  }, [])

  const loadEligibleTeams = useCallback(
    async (q?: string) => {
      setIsLoadingTeams(true)
      try {
        const teams = await instancesService.listTeamsWithoutInstance(q)
        setEligibleTeams(teams)
      } catch (err) {
        console.error("[BackofficeWhatsAppInstancesContext][loadEligibleTeams]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao carregar times")
      } finally {
        setIsLoadingTeams(false)
      }
    },
    [instancesService]
  )

  const provisionInstance = useCallback(
    async (data: ProvisionWhatsAppInstanceFormData) => {
      setIsProvisioning(true)
      try {
        const result = await instancesService.provision(data)
        if (result.isValid) {
          toast.success(result.successMessages?.[0] ?? "Instância provisionada")
          setIsProvisionOpen(false)
          await refreshList()
        } else {
          toast.error(result.errorMessages?.[0] ?? "Erro ao provisionar instância")
        }
        return { isValid: result.isValid, errorMessages: result.errorMessages ?? [] }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao provisionar instância"
        toast.error(message)
        return { isValid: false, errorMessages: [message] }
      } finally {
        setIsProvisioning(false)
      }
    },
    [instancesService, refreshList]
  )

  const previewResyncWebhooks = useCallback(async () => {
    setIsResyncingWebhooks(true)
    try {
      const result = await instancesService.previewResyncWebhooks()
      if (result.isValid && result.result) {
        setWebhookResyncResult(result.result)
      } else {
        toast.error(result.errorMessages?.[0] ?? "Erro ao pré-visualizar webhooks")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao pré-visualizar webhooks"
      toast.error(message)
    } finally {
      setIsResyncingWebhooks(false)
    }
  }, [instancesService])

  const confirmResyncWebhooks = useCallback(async () => {
    setIsResyncingWebhooks(true)
    try {
      const result = await instancesService.confirmResyncWebhooks()
      if (result.result) {
        setWebhookResyncResult(result.result)
      }
      if (result.isValid) {
        toast.success(result.successMessages?.[0] ?? "Webhooks reaplicados")
      } else {
        toast.error(result.errorMessages?.[0] ?? "Erro ao reaplicar webhooks")
      }
      return { isValid: result.isValid, errorMessages: result.errorMessages ?? [] }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao reaplicar webhooks"
      toast.error(message)
      return { isValid: false, errorMessages: [message] }
    } finally {
      setIsResyncingWebhooks(false)
    }
  }, [instancesService])

  return (
    <BackofficeWhatsAppInstancesContext.Provider
      value={{
        instances,
        pagination,
        filters,
        selectedDetail,
        eligibleTeams,
        isLoading,
        isLoadingDetail,
        isLoadingTeams,
        isSaving,
        isReconnecting,
        isDisconnecting,
        isSyncing,
        isProvisioning,
        isResyncingWebhooks,
        webhookResyncResult,
        canManage,
        error,
        selectedConfigId,
        isProvisionOpen,
        setFilters,
        setPage,
        setPageSize,
        openDetail,
        closeDetail,
        refreshList,
        updateInstance,
        reconnectInstance,
        disconnectInstance,
        syncHistory,
        openProvision,
        closeProvision,
        loadEligibleTeams,
        provisionInstance,
        previewResyncWebhooks,
        confirmResyncWebhooks,
      }}
    >
      {children}
    </BackofficeWhatsAppInstancesContext.Provider>
  )
}
