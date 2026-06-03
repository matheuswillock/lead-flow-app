"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { EmailSettingsService } from "../services/EmailSettingsService"
import type { BlockedDateRange, DomainConnectResult, DomainRecord, EmailSettings, ResendDomainStatus } from "./EmailSettingsTypes"

const service = new EmailSettingsService()

export type EmailSettingsHookReturn = {
  settings: EmailSettings | null
  loading: boolean
  saving: boolean

  // Sender
  fromName: string
  fromEmail: string
  replyTo: string
  setFromName: (v: string) => void
  setFromEmail: (v: string) => void
  setReplyTo: (v: string) => void

  // Dispatch restrictions
  dispatchBlockedDates: BlockedDateRange[]
  dispatchTimeFrom: string
  dispatchTimeTo: string
  setDispatchTimeFrom: (v: string) => void
  setDispatchTimeTo: (v: string) => void
  addBlockedDate: (entry: BlockedDateRange) => void
  removeBlockedDate: (index: number) => void

  // Permissions
  dispatchAllowedRoles: string[]
  templateCreateRoles: string[]
  toggleDispatchRole: (role: string) => void
  toggleTemplateCreateRole: (role: string) => void

  // Template approval
  templateApprovalRequired: boolean
  setTemplateApprovalRequired: (v: boolean) => void

  // Save (non-domain)
  handleSave: () => Promise<void>

  // Domain
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
}

export function useEmailSettings(): EmailSettingsHookReturn {
  const [settings, setSettings] = useState<EmailSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Sender
  const [fromName, setFromName] = useState("")
  const [fromEmail, setFromEmail] = useState("")
  const [replyTo, setReplyTo] = useState("")

  // Dispatch restrictions
  const [dispatchBlockedDates, setDispatchBlockedDates] = useState<BlockedDateRange[]>([])
  const [dispatchTimeFrom, setDispatchTimeFrom] = useState("")
  const [dispatchTimeTo, setDispatchTimeTo] = useState("")

  // Permissions
  const [dispatchAllowedRoles, setDispatchAllowedRoles] = useState<string[]>(["manager", "backoffice"])
  const [templateCreateRoles, setTemplateCreateRoles] = useState<string[]>(["manager", "backoffice"])

  // Template approval
  const [templateApprovalRequired, setTemplateApprovalRequired] = useState(false)

  // Domain
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
    setFromName(result.fromName)
    setFromEmail(result.fromEmail)
    setReplyTo(result.replyTo ?? "")
    setDispatchBlockedDates(result.dispatchBlockedDates ?? [])
    setDispatchTimeFrom(result.dispatchTimeFrom ?? "")
    setDispatchTimeTo(result.dispatchTimeTo ?? "")
    setDispatchAllowedRoles(result.dispatchAllowedRoles ?? ["manager", "backoffice"])
    setTemplateCreateRoles(result.templateCreateRoles ?? ["manager", "backoffice"])
    setTemplateApprovalRequired(result.templateApprovalRequired ?? false)
    setDomainStatus(result.resendDomainStatus)
    setDomainName(result.resendDomainName)
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
    if (!fromName.trim() || !fromEmail.trim()) {
      toast.error("Nome e email do remetente são obrigatórios")
      return
    }
    if (dispatchAllowedRoles.length === 0) {
      toast.error("Pelo menos uma role deve ter permissão de disparo")
      return
    }
    setSaving(true)
    try {
      const updated = await service.update({
        fromName: fromName.trim(),
        fromEmail: fromEmail.trim(),
        replyTo: replyTo.trim() || null,
        dispatchBlockedDates: dispatchBlockedDates.length > 0 ? dispatchBlockedDates : null,
        dispatchTimeFrom: dispatchTimeFrom.trim() || null,
        dispatchTimeTo: dispatchTimeTo.trim() || null,
        dispatchAllowedRoles,
        templateCreateRoles,
        templateApprovalRequired,
      })
      applySettings(updated)
      toast.success("Configurações salvas com sucesso")
    } catch (err) {
      console.error("[useEmailSettings] handleSave error", err)
      toast.error("Erro ao salvar configurações")
    } finally {
      setSaving(false)
    }
  }, [fromName, fromEmail, replyTo, dispatchBlockedDates, dispatchTimeFrom, dispatchTimeTo, dispatchAllowedRoles, templateCreateRoles, templateApprovalRequired, applySettings])

  const addBlockedDate = useCallback((entry: BlockedDateRange) => {
    setDispatchBlockedDates((prev) => [...prev, entry])
  }, [])

  const removeBlockedDate = useCallback((index: number) => {
    setDispatchBlockedDates((prev) => prev.filter((_, i) => i !== index))
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
    fromName, fromEmail, replyTo,
    setFromName, setFromEmail, setReplyTo,
    dispatchBlockedDates, dispatchTimeFrom, dispatchTimeTo,
    setDispatchTimeFrom, setDispatchTimeTo,
    addBlockedDate, removeBlockedDate,
    dispatchAllowedRoles, templateCreateRoles,
    toggleDispatchRole, toggleTemplateCreateRole,
    templateApprovalRequired, setTemplateApprovalRequired,
    handleSave,
    domainInput, setDomainInput,
    domainRecords, domainStatus, domainName,
    connectingDomain, verifyingDomain, loadingRecords, disconnectingDomain,
    handleConnectDomain, handleDisconnectDomain, handleVerifyDomain, handleLoadDomainRecords,
  }
}
