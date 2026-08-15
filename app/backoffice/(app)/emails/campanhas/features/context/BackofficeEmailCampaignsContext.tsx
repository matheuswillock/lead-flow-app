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
import type { IBackofficeEmailCampaignsService } from "../services/IBackofficeEmailCampaignsService"
import type {
  BackofficeEmailCampaignDispatchItem,
  BackofficeEmailCampaignItem,
  BackofficeEmailContactListOption,
  BackofficeEmailTemplateOption,
  CreateBackofficeEmailCampaignFormData,
} from "./BackofficeEmailCampaignsTypes"

export interface BackofficeEmailCampaignsContextValue {
  campaigns: BackofficeEmailCampaignItem[]
  contactLists: BackofficeEmailContactListOption[]
  templates: BackofficeEmailTemplateOption[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  refresh: () => Promise<void>
  createCampaign: (data: CreateBackofficeEmailCampaignFormData) => Promise<boolean>
  updateCampaign: (
    id: string,
    data: Partial<CreateBackofficeEmailCampaignFormData>
  ) => Promise<boolean>
  cancelCampaign: (id: string) => Promise<void>
  sendNow: (id: string) => Promise<void>
  listDispatches: (id: string) => Promise<BackofficeEmailCampaignDispatchItem[]>
}

export const BackofficeEmailCampaignsContext = createContext<
  BackofficeEmailCampaignsContextValue | undefined
>(undefined)

interface ProviderProps {
  children: ReactNode
  service: IBackofficeEmailCampaignsService
}

export function BackofficeEmailCampaignsProvider({ children, service }: ProviderProps) {
  const [campaigns, setCampaigns] = useState<BackofficeEmailCampaignItem[]>([])
  const [contactLists, setContactLists] = useState<BackofficeEmailContactListOption[]>([])
  const [templates, setTemplates] = useState<BackofficeEmailTemplateOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsLoading(true)
    setError(null)
    try {
      const [campaignList, listOptions, templateOptions] = await Promise.all([
        service.listCampaigns(),
        service.listContactLists(),
        service.listTemplates(),
      ])
      setCampaigns(campaignList)
      setContactLists(listOptions)
      setTemplates(templateOptions)
    } catch (err) {
      console.error("[BackofficeEmailCampaignsContext][refresh]", err)
      setError(err instanceof Error ? err.message : "Erro ao carregar campanhas")
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [service])

  const createCampaign = useCallback(
    async (data: CreateBackofficeEmailCampaignFormData) => {
      setIsSaving(true)
      try {
        const created = await service.createCampaign(data)
        setCampaigns((prev) => [created, ...prev])
        toast.success("Campanha criada com sucesso")
        return true
      } catch (err) {
        console.error("[BackofficeEmailCampaignsContext][createCampaign]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao criar campanha")
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [service]
  )

  const updateCampaign = useCallback(
    async (id: string, data: Partial<CreateBackofficeEmailCampaignFormData>) => {
      setIsSaving(true)
      try {
        const updated = await service.updateCampaign(id, data)
        setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)))
        toast.success("Campanha atualizada com sucesso")
        return true
      } catch (err) {
        console.error("[BackofficeEmailCampaignsContext][updateCampaign]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar campanha")
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [service]
  )

  const cancelCampaign = useCallback(
    async (id: string) => {
      try {
        const updated = await service.cancelCampaign(id)
        setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)))
        toast.success("Campanha cancelada")
      } catch (err) {
        console.error("[BackofficeEmailCampaignsContext][cancelCampaign]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao cancelar campanha")
      }
    },
    [service]
  )

  const sendNow = useCallback(
    async (id: string) => {
      try {
        const updated = await service.sendNow(id)
        setCampaigns((prev) => prev.map((c) => (c.id === id ? updated : c)))
        toast.success("Envio iniciado — acompanhe o progresso na lista")
      } catch (err) {
        console.error("[BackofficeEmailCampaignsContext][sendNow]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao enviar campanha")
      }
    },
    [service]
  )

  const listDispatches = useCallback(
    async (id: string) => {
      try {
        return await service.listDispatches(id)
      } catch (err) {
        console.error("[BackofficeEmailCampaignsContext][listDispatches]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao carregar histórico de disparos")
        return []
      }
    },
    [service]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<BackofficeEmailCampaignsContextValue>(
    () => ({
      campaigns,
      contactLists,
      templates,
      isLoading,
      isSaving,
      error,
      refresh,
      createCampaign,
      updateCampaign,
      cancelCampaign,
      sendNow,
      listDispatches,
    }),
    [
      campaigns,
      contactLists,
      templates,
      isLoading,
      isSaving,
      error,
      refresh,
      createCampaign,
      updateCampaign,
      cancelCampaign,
      sendNow,
      listDispatches,
    ]
  )

  return (
    <BackofficeEmailCampaignsContext.Provider value={value}>
      {children}
    </BackofficeEmailCampaignsContext.Provider>
  )
}
