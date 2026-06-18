"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { EmailSettingsService } from "../services/EmailSettingsService"
import type { UpsertEmailSenderData, UpsertEmailVariableData } from "../services/IEmailSettingsService"
import type {
  BlockedDateRange,
  DomainConnectResult,
  DomainRecord,
  EmailGlobalVariable,
  EmailSender,
  EmailSettings,
  ResendDomainStatus,
} from "./EmailSettingsTypes"

const service = new EmailSettingsService()

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
  connectingDomain: boolean
  verifyingDomain: boolean
  loadingRecords: boolean
  disconnectingDomain: boolean
  handleConnectDomain: () => Promise<void>
  handleDisconnectDomain: () => Promise<void>
  handleVerifyDomain: () => Promise<void>
  handleLoadDomainRecords: () => Promise<void>

  globalVariables: EmailGlobalVariable[]
  creatingVariable: boolean
  updatingVariableId: string | null
  deletingVariableId: string | null
  handleCreateVariable: (data: UpsertEmailVariableData) => Promise<void>
  handleUpdateVariable: (variableId: string, data: UpsertEmailVariableData) => Promise<void>
  handleDeleteVariable: (variableId: string) => Promise<void>
}

export function useEmailSettings(): EmailSettingsHookReturn {
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
  const [connectingDomain, setConnectingDomain] = useState(false)
  const [verifyingDomain, setVerifyingDomain] = useState(false)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [disconnectingDomain, setDisconnectingDomain] = useState(false)

  const fetchingRef = useRef(false)

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
    setSenders(result.senders ?? [])
    setDefaultSenderId(result.defaultSenderId ?? null)
    setGlobalVariables(result.globalVariables ?? [])
  }, [])

  const fetchSettings = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const result = await service.get()
      applySettings(result)
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
      setDomainRecords(result.records)
      setDomainInput("")
      toast.success("Domínio conectado. Configure os registros DNS abaixo.")
    } catch (err) {
      console.error("[useEmailSettings] handleConnectDomain error", err)
      toast.error(err instanceof Error ? err.message : "Erro ao conectar domínio")
    } finally {
      setConnectingDomain(false)
    }
  }, [domainInput])

  const handleDisconnectDomain = useCallback(async () => {
    setDisconnectingDomain(true)
    try {
      await service.disconnectDomain()
      setDomainName(null)
      setDomainStatus(null)
      setDomainRecords([])
      toast.success("Domínio desconectado")
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
    connectingDomain,
    verifyingDomain,
    loadingRecords,
    disconnectingDomain,
    handleConnectDomain,
    handleDisconnectDomain,
    handleVerifyDomain,
    handleLoadDomainRecords,
    globalVariables,
    creatingVariable,
    updatingVariableId,
    deletingVariableId,
    handleCreateVariable,
    handleUpdateVariable,
    handleDeleteVariable,
  }
}
