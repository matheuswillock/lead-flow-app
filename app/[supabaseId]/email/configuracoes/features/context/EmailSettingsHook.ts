"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { toastUserError, toUserToastMessage } from "@/lib/ui/to-user-toast-message"
import { EmailSettingsService } from "../services/EmailSettingsService"
import type {
  ConfigureDomainTrackingData,
  UpsertEmailSenderData,
  UpsertEmailVariableData,
} from "../services/IEmailSettingsService"
import type {
  BlockedDateRange,
  DomainConnectResult,
  DomainDnsProvider,
  DomainEvent,
  DomainRecord,
  EmailGlobalVariable,
  EmailSender,
  EmailSettings,
  FormDomain,
  ResendDomainStatus,
} from "./EmailSettingsTypes"
import { useOptionalStudioEmailHost } from "@/lib/email/studio-email-host"
import {
  buildDnsInstructionsAgentPrompt,
  buildDnsInstructionsText,
} from "@/lib/email/custom-domain-dns-instructions"
import { suggestFormDomainHostname } from "@/lib/public-forms/suggest-form-domain-hostname"

const defaultService = new EmailSettingsService()
const SENDER_DOMAIN_ERROR_PREFIX = "O e-mail do remetente deve usar o domínio cadastrado"

export function buildSenderErrorMessage(error: unknown, domainName: string | null): string {
  const message = error instanceof Error ? error.message : String(error ?? "")
  if (!message.includes(SENDER_DOMAIN_ERROR_PREFIX)) return toUserToastMessage(error)

  const normalizedDomain = domainName?.trim()
  return normalizedDomain
    ? `Não foi possível cadastrar o remetente porque ele não possui o domínio cadastrado. Use um e-mail com o domínio cadastrado (@${normalizedDomain}).`
    : "Não foi possível cadastrar o remetente porque ele não possui o domínio cadastrado."
}

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
  senderErrorMessage: string | null
  clearSenderErrorMessage: () => void
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
  domainDnsProvider: DomainDnsProvider | null
  domainConnectedAt: string | null
  domainOpenTracking: boolean
  domainClickTracking: boolean
  domainTrackingSubdomain: string | null
  domainDispatchWarnings: string[]
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
  sendingDnsInstructions: boolean
  canSendDnsInstructions: boolean
  handleCopyDnsInstructions: () => Promise<void>
  handleCopyDnsInstructionsPrompt: () => Promise<void>
  handleSendDnsInstructions: (recipientEmail: string) => Promise<boolean>

  formDomain: FormDomain | null
  formDomainInput: string
  setFormDomainInput: (v: string) => void
  formDomainRecords: DomainRecord[]
  canManageFormDomain: boolean
  canSendFormDomainDnsInstructions: boolean
  connectingFormDomain: boolean
  verifyingFormDomain: boolean
  disconnectingFormDomain: boolean
  loadingFormDomainRecords: boolean
  sendingFormDomainDnsInstructions: boolean
  handleConnectFormDomain: () => Promise<void>
  handleDisconnectFormDomain: () => Promise<void>
  handleVerifyFormDomain: () => Promise<void>
  handleLoadFormDomainRecords: () => Promise<void>
  handleCopyFormDomainDnsInstructions: () => Promise<void>
  handleCopyFormDomainDnsInstructionsPrompt: () => Promise<void>
  handleSendFormDomainDnsInstructions: (recipientEmail: string) => Promise<boolean>

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
  const [senderErrorMessage, setSenderErrorMessage] = useState<string | null>(null)

  const [globalVariables, setGlobalVariables] = useState<EmailGlobalVariable[]>([])
  const [creatingVariable, setCreatingVariable] = useState(false)
  const [updatingVariableId, setUpdatingVariableId] = useState<string | null>(null)
  const [deletingVariableId, setDeletingVariableId] = useState<string | null>(null)

  const [domainInput, setDomainInput] = useState("")
  const [domainRecords, setDomainRecords] = useState<DomainRecord[]>([])
  const [domainStatus, setDomainStatus] = useState<ResendDomainStatus | null>(null)
  const [domainName, setDomainName] = useState<string | null>(null)
  const [domainRegion, setDomainRegion] = useState<string | null>(null)
  const [domainDnsProvider, setDomainDnsProvider] = useState<DomainDnsProvider | null>(null)
  const [domainConnectedAt, setDomainConnectedAt] = useState<string | null>(null)
  const [domainOpenTracking, setDomainOpenTracking] = useState(false)
  const [domainClickTracking, setDomainClickTracking] = useState(false)
  const [domainTrackingSubdomain, setDomainTrackingSubdomain] = useState<string | null>(null)
  /**
   * Vem pronto do servidor, não é recalculado aqui.
   *
   * O recálculo local só enxergava `domainStatus`, e desde que o gate passou a
   * distinguir DNS de envio de DNS de tracking isso divergia: para um domínio
   * `partially_failed` com DKIM e SPF íntegros, o servidor responde "dispara
   * sem medir" e o cliente respondia "disparo bloqueado". A regra depende de
   * `resendSendingDnsVerified`, que não é exposto no DTO — e não precisa ser,
   * porque o servidor já manda a conclusão em `resendDomainDispatchWarnings`.
   */
  const [domainDispatchWarnings, setDomainDispatchWarnings] = useState<string[]>([])
  const [domainEvents, setDomainEvents] = useState<DomainEvent[]>([])
  const [connectingDomain, setConnectingDomain] = useState(false)
  const [verifyingDomain, setVerifyingDomain] = useState(false)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [disconnectingDomain, setDisconnectingDomain] = useState(false)
  const [configuringDomainTracking, setConfiguringDomainTracking] = useState(false)
  const [sendingDnsInstructions, setSendingDnsInstructions] = useState(false)

  const [formDomain, setFormDomain] = useState<FormDomain | null>(null)
  const [formDomainLoaded, setFormDomainLoaded] = useState(false)
  const [formDomainInput, setFormDomainInput] = useState("")
  const [formDomainRecords, setFormDomainRecords] = useState<DomainRecord[]>([])
  const [connectingFormDomain, setConnectingFormDomain] = useState(false)
  const [verifyingFormDomain, setVerifyingFormDomain] = useState(false)
  const [disconnectingFormDomain, setDisconnectingFormDomain] = useState(false)
  const [loadingFormDomainRecords, setLoadingFormDomainRecords] = useState(false)
  const [sendingFormDomainDnsInstructions, setSendingFormDomainDnsInstructions] = useState(false)

  const fetchingRef = useRef(false)
  const lastSettingsKeyRef = useRef("")
  const fetchingFormDomainRef = useRef(false)
  const lastFormDomainKeyRef = useRef("")
  const formDomainSuggestionAppliedRef = useRef(false)

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
    setDomainDispatchWarnings(result.resendDomainDispatchWarnings ?? [])
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

  /**
   * Refaz o GET ignorando o dedupe. Necessário depois de mexer no domínio:
   * `resendDomainDispatchWarnings` é decidido no servidor, então mudar o
   * tracking sem reler deixaria o aviso na tela contradizendo o estado real.
   */
  const reloadSettings = useCallback(async () => {
    lastSettingsKeyRef.current = ""
    await fetchSettings()
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
    setSenderErrorMessage(null)
    try {
      await service.createSender(data)
      await fetchSettings()
      toast.success("Remetente criado com sucesso")
    } catch (err) {
      console.error("[useEmailSettings] handleCreateSender error", err)
      const message = buildSenderErrorMessage(err, domainName)
      setSenderErrorMessage(message)
      toast.error(message)
    } finally {
      setCreatingSender(false)
    }
  }, [domainName, fetchSettings])

  const handleUpdateSender = useCallback(async (senderId: string, data: UpsertEmailSenderData) => {
    setUpdatingSenderId(senderId)
    setSenderErrorMessage(null)
    try {
      await service.updateSender(senderId, data)
      await fetchSettings()
      toast.success("Remetente atualizado com sucesso")
    } catch (err) {
      console.error("[useEmailSettings] handleUpdateSender error", err)
      const message = buildSenderErrorMessage(err, domainName)
      setSenderErrorMessage(message)
      toast.error(message)
    } finally {
      setUpdatingSenderId(null)
    }
  }, [domainName, fetchSettings])

  const handleDeleteSender = useCallback(async (senderId: string) => {
    setDeletingSenderId(senderId)
    setSenderErrorMessage(null)
    try {
      await service.deleteSender(senderId)
      await fetchSettings()
      toast.success("Remetente removido com sucesso")
    } catch (err) {
      console.error("[useEmailSettings] handleDeleteSender error", err)
      toastUserError(err)
    } finally {
      setDeletingSenderId(null)
    }
  }, [fetchSettings])

  const handleSetDefaultSender = useCallback(async (senderId: string) => {
    setSettingDefaultSenderId(senderId)
    setSenderErrorMessage(null)
    try {
      const updated = await service.setDefaultSender(senderId)
      applySettings(updated)
      toast.success("Remetente padrão atualizado")
    } catch (err) {
      console.error("[useEmailSettings] handleSetDefaultSender error", err)
      toastUserError(err)
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
      toastUserError(err)
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
      toastUserError(err)
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
      toastUserError(err)
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
      setDomainDnsProvider(result.dnsProvider ?? null)
      setDomainConnectedAt(result.connectedAt ?? new Date().toISOString())
      setDomainOpenTracking(result.openTracking ?? true)
      setDomainClickTracking(result.clickTracking ?? true)
      setDomainTrackingSubdomain(result.trackingSubdomain ?? "links")
      setDomainRecords(result.records)
      setDomainEvents(result.events ?? [])
      setDomainInput("")
      // `reloadSettings`, não `fetchSettings`: o dedupe usa uma chave constante,
      // então o `fetchSettings` que existia aqui era um no-op desde o primeiro
      // load — e os avisos ficavam os do domínio anterior até um reload de página.
      await reloadSettings()
      toast.success("Domínio conectado. Configure os registros DNS abaixo.")
    } catch (err) {
      console.error("[useEmailSettings] handleConnectDomain error", err)
      toastUserError(err)
    } finally {
      setConnectingDomain(false)
    }
  }, [domainInput, reloadSettings])

  const handleDisconnectDomain = useCallback(async () => {
    setDisconnectingDomain(true)
    try {
      await service.disconnectDomain()
      setDomainName(null)
      setDomainStatus(null)
      setDomainRegion(null)
      setDomainDnsProvider(null)
      setDomainConnectedAt(null)
      setDomainOpenTracking(false)
      setDomainClickTracking(false)
      setDomainTrackingSubdomain(null)
      setDomainRecords([])
      setDomainEvents([])
      // Sem domínio não há o que avisar. Deixar a lista anterior na tela faria o
      // card alertar sobre um domínio que não existe mais.
      setDomainDispatchWarnings([])
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
      setDomainDnsProvider(result.dnsProvider ?? null)
      setDomainConnectedAt(result.connectedAt ?? domainConnectedAt)
      setDomainOpenTracking(result.openTracking ?? domainOpenTracking)
      setDomainClickTracking(result.clickTracking ?? domainClickTracking)
      setDomainTrackingSubdomain(result.trackingSubdomain ?? domainTrackingSubdomain)
      if (result.events) setDomainEvents(result.events)
      // `getDomainRecords` roda `syncFromResendDomain` no servidor, então este é
      // o ponto em que `resendSendingDnsVerified` costuma mudar. Reler mantém o
      // aviso coerente com o que o gate passou a decidir.
      void reloadSettings()
    } catch (err) {
      console.error("[useEmailSettings] handleLoadDomainRecords error", err)
    } finally {
      setLoadingRecords(false)
    }
  }, [reloadSettings])

  const handleVerifyDomain = useCallback(async () => {
    setVerifyingDomain(true)
    try {
      const result = await service.verifyDomain()
      setDomainStatus(result.status)
      toast.success("Verificação iniciada. Aguarde a propagação do DNS.")
      void handleLoadDomainRecords()
      void reloadSettings()
    } catch (err) {
      console.error("[useEmailSettings] handleVerifyDomain error", err)
      toast.error("Erro ao verificar domínio")
    } finally {
      setVerifyingDomain(false)
    }
  }, [handleLoadDomainRecords, reloadSettings])

  /**
   * As instruções são montadas dos registros já carregados na tela — os mesmos
   * que a tabela renderiza. Sem registros não há o que copiar, então o guard
   * orienta a carregar em vez de copiar um texto vazio.
   */
  const copyDnsArtifactToClipboard = useCallback(
    async (buildArtifact: typeof buildDnsInstructionsText, successMessage: string) => {
      if (!domainName || domainRecords.length === 0) {
        toast.error("Carregue os registros DNS antes de copiar as instruções")
        return
      }
      try {
        await navigator.clipboard.writeText(
          buildArtifact({
            domainName,
            records: domainRecords,
            providerName: domainDnsProvider?.name ?? null,
          })
        )
        toast.success(successMessage)
      } catch (err) {
        console.error("[useEmailSettings] copyDnsArtifactToClipboard error", err)
        toast.error("Não foi possível copiar")
      }
    },
    [domainName, domainRecords, domainDnsProvider]
  )

  const handleCopyDnsInstructions = useCallback(
    () => copyDnsArtifactToClipboard(buildDnsInstructionsText, "Instruções copiadas"),
    [copyDnsArtifactToClipboard]
  )

  const handleCopyDnsInstructionsPrompt = useCallback(
    () => copyDnsArtifactToClipboard(buildDnsInstructionsAgentPrompt, "Prompt copiado"),
    [copyDnsArtifactToClipboard]
  )

  /**
   * O host do backoffice ainda não expõe o envio de instruções — o card usa
   * esta flag para esconder a ação em vez de falhar no clique.
   */
  const canSendDnsInstructions = typeof service.sendDomainDnsInstructions === "function"

  const handleSendDnsInstructions = useCallback(
    async (recipientEmail: string) => {
      if (sendingDnsInstructions) return false
      if (!service.sendDomainDnsInstructions) {
        toast.error("Envio de instruções não disponível nesta tela")
        return false
      }
      setSendingDnsInstructions(true)
      try {
        await service.sendDomainDnsInstructions(recipientEmail)
        toast.success(`Instruções enviadas para ${recipientEmail}`)
        return true
      } catch (err) {
        console.error("[useEmailSettings] handleSendDnsInstructions error", err)
        toastUserError(err)
        return false
      } finally {
        setSendingDnsInstructions(false)
      }
    },
    [sendingDnsInstructions]
  )

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
        void reloadSettings()
        return true
      } catch (err) {
        console.error("[useEmailSettings] handleConfigureDomainTracking error", err)
        toastUserError(err)
        return false
      } finally {
        setConfiguringDomainTracking(false)
      }
    },
    [configuringDomainTracking, domainRegion, reloadSettings]
  )

  // ---------- Domínio dos formulários (Frente C — Deliverability) ----------

  /**
   * O host do backoffice ainda não expõe o domínio de formulários — os métodos
   * são opcionais no contrato e o card some quando não existem (mesmo padrão
   * de `canSendDnsInstructions`).
   */
  const canManageFormDomain = typeof service.getFormDomain === "function"
  const canSendFormDomainDnsInstructions =
    typeof service.sendFormDomainDnsInstructions === "function"

  const handleLoadFormDomainRecords = useCallback(async () => {
    if (!service.getFormDomainRecords) return
    setLoadingFormDomainRecords(true)
    try {
      const result = await service.getFormDomainRecords()
      setFormDomainRecords(result.records ?? [])
      if (result.formDomain) setFormDomain(result.formDomain)
    } catch (err) {
      console.error("[useEmailSettings] handleLoadFormDomainRecords error", err)
    } finally {
      setLoadingFormDomainRecords(false)
    }
  }, [service])

  const fetchFormDomain = useCallback(async () => {
    if (!service.getFormDomain) return
    const key = "email-settings-form-domain"
    if (fetchingFormDomainRef.current || lastFormDomainKeyRef.current === key) return
    fetchingFormDomainRef.current = true
    try {
      const result = await service.getFormDomain()
      setFormDomain(result.formDomain ?? null)
      setFormDomainLoaded(true)
      lastFormDomainKeyRef.current = key
      if (result.formDomain) {
        void handleLoadFormDomainRecords()
      }
    } catch (err) {
      console.error("[useEmailSettings] fetchFormDomain error", err)
    } finally {
      fetchingFormDomainRef.current = false
    }
  }, [handleLoadFormDomainRecords, service])

  useEffect(() => {
    void fetchFormDomain()
  }, [fetchFormDomain])

  /**
   * Sugestão única de `forms.<dominio-do-time>` quando o domínio de ENVIO já
   * está verificado e ainda não há domínio de formulários. Nunca sobrescreve
   * o que o usuário digitou.
   */
  useEffect(() => {
    if (formDomainSuggestionAppliedRef.current) return
    if (!formDomainLoaded || formDomain) return
    if (!settings?.resendDomainName || settings.resendDomainStatus !== "verified") return

    const suggestion = suggestFormDomainHostname(settings.resendDomainName)
    if (!suggestion) return

    formDomainSuggestionAppliedRef.current = true
    setFormDomainInput((prev) => prev || suggestion)
  }, [formDomain, formDomainLoaded, settings])

  const handleConnectFormDomain = useCallback(async () => {
    if (connectingFormDomain) return
    if (!service.connectFormDomain) return
    const hostname = formDomainInput.trim()
    if (!hostname) {
      toast.error("Informe o subdomínio dos formulários")
      return
    }
    setConnectingFormDomain(true)
    try {
      const result = await service.connectFormDomain(hostname)
      setFormDomain(result.formDomain ?? null)
      setFormDomainRecords(result.records ?? [])
      setFormDomainInput("")
      lastFormDomainKeyRef.current = ""
      toast.success("Domínio de formulários conectado. Crie o registro DNS para ativar.")
    } catch (err) {
      console.error("[useEmailSettings] handleConnectFormDomain error", err)
      toastUserError(err)
    } finally {
      setConnectingFormDomain(false)
    }
  }, [connectingFormDomain, formDomainInput, service])

  const handleDisconnectFormDomain = useCallback(async () => {
    if (disconnectingFormDomain) return
    if (!service.disconnectFormDomain) return
    setDisconnectingFormDomain(true)
    try {
      await service.disconnectFormDomain()
      setFormDomain(null)
      setFormDomainRecords([])
      lastFormDomainKeyRef.current = ""
      toast.success("Domínio de formulários removido")
    } catch (err) {
      console.error("[useEmailSettings] handleDisconnectFormDomain error", err)
      toastUserError(err)
    } finally {
      setDisconnectingFormDomain(false)
    }
  }, [disconnectingFormDomain, service])

  const handleVerifyFormDomain = useCallback(async () => {
    if (verifyingFormDomain) return
    if (!service.verifyFormDomain) return
    setVerifyingFormDomain(true)
    try {
      const result = await service.verifyFormDomain()
      if (result.formDomain) setFormDomain(result.formDomain)
      if (result.formDomain?.status === "verified") {
        toast.success(
          "Domínio verificado! Os novos disparos de campanha usarão este domínio nos links de formulário."
        )
      } else if (result.formDomain?.status === "failed") {
        toast.error("O domínio não está mais ativo. Remova e conecte novamente.")
      } else {
        toast.info("DNS ainda não propagado. Verifique novamente em alguns minutos.")
      }
      void handleLoadFormDomainRecords()
    } catch (err) {
      console.error("[useEmailSettings] handleVerifyFormDomain error", err)
      toastUserError(err)
    } finally {
      setVerifyingFormDomain(false)
    }
  }, [handleLoadFormDomainRecords, service, verifyingFormDomain])

  const copyFormDomainDnsArtifactToClipboard = useCallback(
    async (buildArtifact: typeof buildDnsInstructionsText, successMessage: string) => {
      if (!formDomain || formDomainRecords.length === 0) {
        toast.error("Carregue o registro DNS antes de copiar as instruções")
        return
      }
      try {
        await navigator.clipboard.writeText(
          buildArtifact({
            domainName: formDomain.hostname,
            records: formDomainRecords,
            providerName: null,
          })
        )
        toast.success(successMessage)
      } catch (err) {
        console.error("[useEmailSettings] copyFormDomainDnsArtifactToClipboard error", err)
        toast.error("Não foi possível copiar")
      }
    },
    [formDomain, formDomainRecords]
  )

  const handleCopyFormDomainDnsInstructions = useCallback(
    () => copyFormDomainDnsArtifactToClipboard(buildDnsInstructionsText, "Instruções copiadas"),
    [copyFormDomainDnsArtifactToClipboard]
  )

  const handleCopyFormDomainDnsInstructionsPrompt = useCallback(
    () => copyFormDomainDnsArtifactToClipboard(buildDnsInstructionsAgentPrompt, "Prompt copiado"),
    [copyFormDomainDnsArtifactToClipboard]
  )

  const handleSendFormDomainDnsInstructions = useCallback(
    async (recipientEmail: string) => {
      if (sendingFormDomainDnsInstructions) return false
      if (!service.sendFormDomainDnsInstructions) {
        toast.error("Envio de instruções não disponível nesta tela")
        return false
      }
      setSendingFormDomainDnsInstructions(true)
      try {
        await service.sendFormDomainDnsInstructions(recipientEmail)
        toast.success(`Instruções enviadas para ${recipientEmail}`)
        return true
      } catch (err) {
        console.error("[useEmailSettings] handleSendFormDomainDnsInstructions error", err)
        toastUserError(err)
        return false
      } finally {
        setSendingFormDomainDnsInstructions(false)
      }
    },
    [sendingFormDomainDnsInstructions, service]
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
    senderErrorMessage,
    clearSenderErrorMessage: () => setSenderErrorMessage(null),
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
    domainDnsProvider,
    domainConnectedAt,
    domainOpenTracking,
    domainClickTracking,
    domainTrackingSubdomain,
    domainDispatchWarnings,
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
    sendingDnsInstructions,
    canSendDnsInstructions,
    handleCopyDnsInstructions,
    handleCopyDnsInstructionsPrompt,
    handleSendDnsInstructions,
    formDomain,
    formDomainInput,
    setFormDomainInput,
    formDomainRecords,
    canManageFormDomain,
    canSendFormDomainDnsInstructions,
    connectingFormDomain,
    verifyingFormDomain,
    disconnectingFormDomain,
    loadingFormDomainRecords,
    sendingFormDomainDnsInstructions,
    handleConnectFormDomain,
    handleDisconnectFormDomain,
    handleVerifyFormDomain,
    handleLoadFormDomainRecords,
    handleCopyFormDomainDnsInstructions,
    handleCopyFormDomainDnsInstructionsPrompt,
    handleSendFormDomainDnsInstructions,
    globalVariables,
    creatingVariable,
    updatingVariableId,
    deletingVariableId,
    handleCreateVariable,
    handleUpdateVariable,
    handleDeleteVariable,
  }
}
