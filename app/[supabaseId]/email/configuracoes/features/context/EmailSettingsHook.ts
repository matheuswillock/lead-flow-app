"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { EmailSettingsService } from "../services/EmailSettingsService"
import type {
  ConfigureDomainTrackingData,
  UpsertEmailSenderData,
  UpsertEmailVariableData,
} from "../services/IEmailSettingsService"
import type {
  BlockedDateRange,
  DomainConnectResult,
  DomainEvent,
  DomainRecord,
  EmailGlobalVariable,
  EmailSender,
  EmailSettings,
  ResendDomainStatus,
} from "./EmailSettingsTypes"
import { useOptionalStudioEmailHost } from "@/lib/email/studio-email-host"

const defaultService = new EmailSettingsService()

export type EmailSettingsHookReturn = {
  settings: EmailSettings | null
  loading: boolean
  saving: boolean

  dispatchBlockedDates: BlockedDateRange[]
  dispatchTimeFrom: string
  dispatchTimeTo: string
  blockedDispatchDays: number[]
  setDispatchTimeFrom: (v: string) => void
  setDispatchTimeTo: (v: string) => void
  addBlockedDate: (entry: BlockedDateRange) => void
  removeBlockedDate: (index: number) => void
  toggleBlockedDispatchDay: (day: number) => void

  dispatchAllowedRoles: string[]
  templateCreateRoles: string[]
  toggleDispatchRole: (role: string) => void
  toggleTemplateCreateRole: (role: string) => void

  templateApprovalRequired: boolean
  templateApprovalRoles: string[]
  setTemplateApprovalRequired: (v: boolean) => void
  toggleTemplateApprovalRole: (role: string) => void

  handleSave: () => Promise<void>

  senders: EmailSender[]
  defaultSenderId: string | null
  creatingSender: boolean
  updatingSenderId: string | null
  deletingSenderId: string | null
  settingDefaultSenderId: string | null
  handleCreateSender: (data: UpsertEmailSenderData) => Promise<void>
  handleUpdateSender: (senderId: string, data: UpsertEmailSenderData) => Promise<void>
  handleDeleteSender: (senderId: string) => Promise<void>
  handleSetDefaultSender: (senderId: string) => Promise<void>

  domainInput: string
  setDomainInput: (v: string) => void
  domainRecords: DomainRecord[]
  domainStatus: ResendDomainStatus | null
  domainName: string | null
  domainRegion: string | null
  domainConnectedAt: string | null
  domainOpenTracking: boolean
  domainClickTracking: boolean
  domainTrackingSubdomain: string | null
  domainEvents: DomainEvent[]
  connectingDomain: boolean
  verifyingDomain: boolean
  loadingRecords: boolean
  disconnectingDomain: boolean
  configuringDomainTracking: boolean
  handleConnectDomain: () => Promise<void>
  handleDisconnectDomain: () => Promise<void>
  handleVerifyDomain: () => Promise<void>
  handleLoadDomainRecords: () => Promise<void>
  handleConfigureDomainTracking: (data: ConfigureDomainTrackingData) => Promise<boolean>

  globalVariables: EmailGlobalVariable[]
  creatingVariable: boolean
  updatingVariableId: string | null
  deletingVariableId: string | null
  handleCreateVariable: (data: UpsertEmailVariableData) => Promise<void>
  handleUpdateVariable: (variableId: string, data: UpsertEmailVariableData) => Promise<void>
  handleDeleteVariable: (variableId: string) => Promise<void>
}

export function useEmailSettings(): EmailSettingsHookReturn {
  const host = useOptionalStudioEmailHost()
  const service = host?.services.emailSettings ?? defaultService
  const [settings, setSettings] = useState<EmailSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [dispatchBlockedDates, setDispatchBlockedDates] = useState<BlockedDateRange[]>([])
  const [dispatchTimeFrom, setDispatchTimeFrom] = useState("")
  const [dispatchTimeTo, setDispatchTimeTo] = useState("")
  const [blockedDispatchDays, setBlockedDispatchDays] = useState<number[]>([])

  const [dispatchAllowedRoles, setDispatchAllowedRoles] = useState<string[]>(["manager", "backoffice"])
  const [templateCreateRoles, setTemplateCreateRoles] = useState<string[]>(["manager", "backoffice"])

  const [templateApprovalRequired, setTemplateApprovalRequired] = useState(false)
  const [templateApprovalRoles, setTemplateApprovalRoles] = useState<string[]>(["manager", "backoffice"])

  const [senders, setSenders] = useState<EmailSender[]>([])
  const [defaultSenderId, setDefaultSenderId] = useState<string | null>(null)
  const [creatingSender, setCreatingSender] = useState(false)
  const [updatingSenderId, setUpdatingSenderId] = useState<string | null>(null)
  const [deletingSenderId, setDeletingSenderId] = useState<string | null>(null)
  const [settingDefaultSenderId, setSettingDefaultSenderId] = useState<string | null>(null)

  const [globalVariables, setGlobalVariables] = useState<EmailGlobalVariable[]>([])
  const [creatingVariable, setCreatingVariable] = useState(false)
  const [updatingVariableId, setUpdatingVariableId] = useState<string | null>(null)
  const [deletingVariableId, setDeletingVariableId] = useState<string | null>(null)

  const [domainInput, setDomainInput] = useState("")
  const [domainRecords, setDomainRecords] = useState<DomainRecord[]>([])
  const [domainStatus, setDomainStatus] = useState<ResendDomainStatus | null>(null)
  const [domainName, setDomainName] = useState<string | null>(null)
  const [domainRegion, setDomainRegion] = useState<string | null>(null)
  const [domainConnectedAt, setDomainConnectedAt] = useState<string | null>(null)
  const [domainOpenTracking, setDomainOpenTracking] = useState(false)
  const [domainClickTracking, setDomainClickTracking] = useState(false)
  const [domainTrackingSubdomain, setDomainTrackingSubdomain] = useState<string | null>(null)
  const [domainEvents, setDomainEvents] = useState<DomainEvent[]>([])
  const [connectingDomain, setConnectingDomain] = useState(false)
  const [verifyingDomain, setVerifyingDomain] = useState(false)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [disconnectingDomain, setDisconnectingDomain] = useState(false)
  const [configuringDomainTracking, setConfiguringDomainTracking] = useState(false)

  const fetchingRef = useRef(false)
  const lastSettingsKeyRef = useRef("")

  const applySettings = useCallback((result: EmailSettings) => {
    setSettings(result)
    setDispatchBlockedDates(result.dispatchBlockedDates ?? [])
    setDispatchTimeFrom(result.dispatchTimeFrom ?? "")
    setDispatchTimeTo(result.dispatchTimeTo ?? "")
    setBlockedDispatchDays(result.blockedDispatchDays ?? [])
    setDispatchAllowedRoles(result.dispatchAllowedRoles ?? ["manager", "backoffice"])
    setTemplateCreateRoles(result.templateCreateRoles ?? ["manager", "backoffice"])
    setTemplateApprovalRequired(result.templateApprovalRequired ?? false)
    setTemplateApprovalRoles(result.templateApprovalRoles ?? ["manager", "backoffice"])
    setDomainStatus(result.resendDomainStatus)
    setDomainName(result.resendDomainName)
    setDomainRegion(result.resendDomainRegion ?? null)
    setDomainConnectedAt(result.resendDomainConnectedAt ?? null)
    setDomainOpenTracking(result.resendOpenTracking ?? false)
    setDomainClickTracking(result.resendClickTracking ?? false)
    setDomainEvents(result.domainEvents ?? [])
    setSenders(result.senders ?? [])
    setDefaultSenderId(result.defaultSenderId ?? null)
    setGlobalVariables(result.globalVariables ?? [])
  }, [])

  const fetchSettings = useCallback(async () => {
    const key = "email-settings"
    if (fetchingRef.current || lastSettingsKeyRef.current === key) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const result = await service.get()
      applySettings(result)
      lastSettingsKeyRef.current = key
    } catch (err) {
      console.error("[useEmailSettings] fetchSettings error", err)
      toast.error("Erro ao carregar configurações de email")
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [applySettings])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  const handleSave = useCallback(async () => {
    if (dispatchAllowedRoles.length === 0) {
      toast.error("Pelo menos uma role deve ter permissão de disparo")
      return
    }
    if (templateCreateRoles.length === 0) {
      toast.error("Pelo menos uma role deve poder criar templates")
      return
    }
    if (templateApprovalRequired && templateApprovalRoles.length === 0) {
      toast.error("Selecione pelo menos uma role aprovadora")
      return
    }

    setSaving(true)
    try {
      const updated = await service.update({
        dispatchBlockedDates: dispatchBlockedDates.length > 0 ? dispatchBlockedDates : null,
        dispatchTimeFrom: dispatchTimeFrom.trim() || null,
        dispatchTimeTo: dispatchTimeTo.trim() || null,
        dispatchAllowedRoles,
        templateCreateRoles,
        templateApprovalRequired,
        templateApprovalRoles,
        blockedDispatchDays: blockedDispatchDays.length > 0 ? blockedDispatchDays : null,
      })
      applySettings(updated)
      toast.success("Configurações salvas com sucesso")
    } catch (err) {
      console.error("[useEmailSettings] handleSave error", err)
      toast.error("Erro ao salvar configurações")
    } finally {
      setSaving(false)
    }
  }, [
    applySettings,
    blockedDispatchDays,
    dispatchAllowedRoles,
    dispatchBlockedDates,
    dispatchTimeFrom,
    dispatchTimeTo,
    templateApprovalRequired,
    templateApprovalRoles,
    templateCreateRoles,
  ])

  const addBlockedDate = useCallback((entry: BlockedDateRange) => {
    setDispatchBlockedDates((prev) => [...prev, entry])
  }, [])

  const removeBlockedDate = useCallback((index: number) => {
    setDispatchBlockedDates((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const toggleBlockedDispatchDay = useCallback((day: number) => {
    setBlockedDispatchDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }, [])

  const toggleDispatchRole = useCallback((role: string) => {
    setDispatchAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }, [])

  const toggleTemplateCreateRole = useCallback((role: string) => {
    setTemplateCreateRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }, [])

  const toggleTemplateApprovalRole = useCallback((role: string) => {
    setTemplateApprovalRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }, [])

  const handleCreateSender = useCallback(async (data: UpsertEmailSenderData) => {
    setCreatingSender(true)
    try {
      await service.createSender(data)
      await fetchSettings()
      toast.success("Remetente criado com sucesso")
    } catch (err) {
      console.error("[useEmailSettings] handleCreateSender error", err)
      toast.error(err instanceof Error ? err.message : "Erro ao criar remetente")
    } finally {
      setCreatingSender(false)
    }
  }, [fetchSettings])

  const handleUpdateSender = useCallback(async (senderId: string, data: UpsertEmailSenderData) => {
    setUpdatingSenderId(senderId)
    try {
      await service.updateSender(senderId, data)
      await fetchSettings()
      toast.success("Remetente atualizado com sucesso")
    } catch (err) {
      console.error("[useEmailSettings] handleUpdateSender error", err)
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar remetente")
    } finally {
      setUpdatingSenderId(null)
    }
  }, [fetchSettings])

  const handleDeleteSender = useCallback(async (senderId: string) => {
    setDeletingSenderId(senderId)
    try {
      await service.deleteSender(senderId)
      await fetchSettings()
      toast.success("Remetente removido com sucesso")
    } catch (err) {
      console.error("[useEmailSettings] handleDeleteSender error", err)
      toast.error(err instanceof Error ? err.message : "Erro ao remover remetente")
    } finally {
      setDeletingSenderId(null)
    }
  }, [fetchSettings])

  const handleSetDefaultSender = useCallback(async (senderId: string) => {
    setSettingDefaultSenderId(senderId)
    try {
      const updated = await service.setDefaultSender(senderId)
      applySettings(updated)
      toast.success("Remetente padrão atualizado")
    } catch (err) {
      console.error("[useEmailSettings] handleSetDefaultSender error", err)
      toast.error(err instanceof Error ? err.message : "Erro ao definir remetente padrão")
    } finally {
      setSettingDefaultSenderId(null)
    }
  }, [applySettings])

  const handleCreateVariable = useCallback(async (data: UpsertEmailVariableData) => {
    setCreatingVariable(true)
    try {
      const created = await service.createVariable(data)
      setGlobalVariables((prev) => [...prev, created].sort((a, b) => a.key.localeCompare(b.key)))
      toast.success("Variável global criada com sucesso")
    } catch (err) {
      console.error("[useEmailSettings] handleCreateVariable error", err)
      toast.error(err instanceof Error ? err.message : "Erro ao criar variável global")
      throw err
    } finally {
      setCreatingVariable(false)
    }
  }, [])

  const handleUpdateVariable = useCallback(async (variableId: string, data: UpsertEmailVariableData) => {
    setUpdatingVariableId(variableId)
    try {
      const updated = await service.updateVariable(variableId, data)
      setGlobalVariables((prev) =>
        prev.map((v) => (v.id === variableId ? updated : v)).sort((a, b) => a.key.localeCompare(b.key))
      )
      toast.success("Variável global atualizada com sucesso")
    } catch (err) {
      console.error("[useEmailSettings] handleUpdateVariable error", err)
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar variável global")
      throw err
    } finally {
      setUpdatingVariableId(null)
    }
  }, [])

  const handleDeleteVariable = useCallback(async (variableId: string) => {
    setDeletingVariableId(variableId)
    try {
      await service.deleteVariable(variableId)
      setGlobalVariables((prev) => prev.filter((v) => v.id !== variableId))
      toast.success("Variável global removida com sucesso")
    } catch (err) {
      console.error("[useEmailSettings] handleDeleteVariable error", err)
      toast.error(err instanceof Error ? err.message : "Erro ao remover variável global")
    } finally {
      setDeletingVariableId(null)
    }
  }, [])

  const handleConnectDomain = useCallback(async () => {
    if (!domainInput.trim()) {
      toast.error("Informe o nome do domínio")
      return
    }
    setConnectingDomain(true)
    try {
      const result: DomainConnectResult = await service.connectDomain(domainInput.trim())
      setDomainName(result.domainName)
      setDomainStatus(result.status as ResendDomainStatus)
      setDomainRegion(result.region ?? null)
      setDomainConnectedAt(result.connectedAt ?? new Date().toISOString())
      setDomainOpenTracking(result.openTracking ?? true)
      setDomainClickTracking(result.clickTracking ?? true)
      setDomainTrackingSubdomain(result.trackingSubdomain ?? "links")
      setDomainRecords(result.records)
      setDomainEvents(result.events ?? [])
      setDomainInput("")
      await fetchSettings()
      toast.success("Domínio conectado. Configure os registros DNS abaixo.")
    } catch (err) {
      console.error("[useEmailSettings] handleConnectDomain error", err)
      toast.error(err instanceof Error ? err.message : "Erro ao conectar domínio")
    } finally {
      setConnectingDomain(false)
    }
  }, [domainInput, fetchSettings])

  const handleDisconnectDomain = useCallback(async () => {
    setDisconnectingDomain(true)
    try {
      await service.disconnectDomain()
      setDomainName(null)
      setDomainStatus(null)
      setDomainRegion(null)
      setDomainConnectedAt(null)
      setDomainOpenTracking(false)
      setDomainClickTracking(false)
      setDomainTrackingSubdomain(null)
      setDomainRecords([])
      setDomainEvents([])
      toast.success("Domínio removido")
    } catch (err) {
      console.error("[useEmailSettings] handleDisconnectDomain error", err)
      toast.error("Erro ao desconectar domínio")
    } finally {
      setDisconnectingDomain(false)
    }
  }, [])

  const handleLoadDomainRecords = useCallback(async () => {
    setLoadingRecords(true)
    try {
      const result: DomainConnectResult = await service.getDomainRecords()
      setDomainRecords(result.records)
      setDomainStatus(result.status as ResendDomainStatus)
      setDomainRegion(result.region ?? domainRegion)
      setDomainConnectedAt(result.connectedAt ?? domainConnectedAt)
      setDomainOpenTracking(result.openTracking ?? domainOpenTracking)
      setDomainClickTracking(result.clickTracking ?? domainClickTracking)
      setDomainTrackingSubdomain(result.trackingSubdomain ?? domainTrackingSubdomain)
      if (result.events) setDomainEvents(result.events)
    } catch (err) {
      console.error("[useEmailSettings] handleLoadDomainRecords error", err)
    } finally {
      setLoadingRecords(false)
    }
  }, [])

  const handleVerifyDomain = useCallback(async () => {
    setVerifyingDomain(true)
    try {
      const result = await service.verifyDomain()
      setDomainStatus(result.status)
      toast.success("Verificação iniciada. Aguarde a propagação do DNS.")
      void handleLoadDomainRecords()
    } catch (err) {
      console.error("[useEmailSettings] handleVerifyDomain error", err)
      toast.error("Erro ao verificar domínio")
    } finally {
      setVerifyingDomain(false)
    }
  }, [handleLoadDomainRecords])

  const handleConfigureDomainTracking = useCallback(
    async (data: ConfigureDomainTrackingData) => {
      if (configuringDomainTracking) return false
      setConfiguringDomainTracking(true)
      try {
        const result = await service.configureDomainTracking(data)
        setDomainRecords(result.records)
        setDomainStatus(result.status as ResendDomainStatus)
        setDomainRegion(result.region ?? domainRegion)
        setDomainOpenTracking(result.openTracking ?? data.openTracking)
        setDomainClickTracking(result.clickTracking ?? data.clickTracking)
        setDomainTrackingSubdomain(result.trackingSubdomain ?? data.trackingSubdomain)
        toast.success(
          "Métricas configuradas. Adicione o registro DNS de Tracking e re-verifique."
        )
        return true
      } catch (err) {
        console.error("[useEmailSettings] handleConfigureDomainTracking error", err)
        toast.error(err instanceof Error ? err.message : "Erro ao configurar métricas de tracking")
        return false
      } finally {
        setConfiguringDomainTracking(false)
      }
    },
    [configuringDomainTracking, domainRegion]
  )

  return {
    settings,
    loading,
    saving,
    dispatchBlockedDates,
    dispatchTimeFrom,
    dispatchTimeTo,
    blockedDispatchDays,
    setDispatchTimeFrom,
    setDispatchTimeTo,
    addBlockedDate,
    removeBlockedDate,
    toggleBlockedDispatchDay,
    dispatchAllowedRoles,
    templateCreateRoles,
    toggleDispatchRole,
    toggleTemplateCreateRole,
    templateApprovalRequired,
    templateApprovalRoles,
    setTemplateApprovalRequired,
    toggleTemplateApprovalRole,
    handleSave,
    senders,
    defaultSenderId,
    creatingSender,
    updatingSenderId,
    deletingSenderId,
    settingDefaultSenderId,
    handleCreateSender,
    handleUpdateSender,
    handleDeleteSender,
    handleSetDefaultSender,
    domainInput,
    setDomainInput,
    domainRecords,
    domainStatus,
    domainName,
    domainRegion,
    domainConnectedAt,
    domainOpenTracking,
    domainClickTracking,
    domainTrackingSubdomain,
    domainEvents,
    connectingDomain,
    verifyingDomain,
    loadingRecords,
    disconnectingDomain,
    configuringDomainTracking,
    handleConnectDomain,
    handleDisconnectDomain,
    handleVerifyDomain,
    handleLoadDomainRecords,
    handleConfigureDomainTracking,
    globalVariables,
    creatingVariable,
    updatingVariableId,
    deletingVariableId,
    handleCreateVariable,
    handleUpdateVariable,
    handleDeleteVariable,
  }
}
