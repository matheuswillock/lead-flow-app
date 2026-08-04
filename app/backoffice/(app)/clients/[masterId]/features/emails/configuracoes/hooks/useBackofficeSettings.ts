"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { backofficeStudioEmailService } from "../../services/BackofficeStudioEmailService"
import type {
  StudioEmailDomainConnectResult,
  StudioEmailResendDomainStatus,
  StudioEmailSender,
  StudioEmailVariable,
} from "../../services/IBackofficeStudioEmailService"
import type {
  UpsertStudioEmailSenderData,
  UpsertStudioEmailVariableData,
} from "../../services/IBackofficeStudioEmailService"

export function useBackofficeSettings(
  masterId: string,
  teamId: string | null,
  refreshKey: number
) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [senders, setSenders] = useState<StudioEmailSender[]>([])
  const [variables, setVariables] = useState<StudioEmailVariable[]>([])

  const [domainInput, setDomainInput] = useState("")
  const [domainName, setDomainName] = useState<string | null>(null)
  const [domainStatus, setDomainStatus] = useState<StudioEmailResendDomainStatus | null>(null)
  const [domainRecords, setDomainRecords] = useState<StudioEmailDomainConnectResult["records"]>([])
  const [connectingDomain, setConnectingDomain] = useState(false)
  const [verifyingDomain, setVerifyingDomain] = useState(false)
  const [loadingRecords, setLoadingRecords] = useState(false)

  const [creatingSender, setCreatingSender] = useState(false)
  const [updatingSenderId, setUpdatingSenderId] = useState<string | null>(null)
  const [deletingSenderId, setDeletingSenderId] = useState<string | null>(null)
  const [settingDefaultSenderId, setSettingDefaultSenderId] = useState<string | null>(null)

  const [creatingVariable, setCreatingVariable] = useState(false)
  const [updatingVariableId, setUpdatingVariableId] = useState<string | null>(null)
  const [deletingVariableId, setDeletingVariableId] = useState<string | null>(null)

  const inFlightRef = useRef(false)

  const load = useCallback(async () => {
    if (!teamId || inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    try {
      const [senderList, variableList, domainResult] = await Promise.all([
        backofficeStudioEmailService.listSenders(masterId, teamId),
        backofficeStudioEmailService.listVariables(masterId, teamId),
        backofficeStudioEmailService.getDomainRecords(masterId, teamId).catch(() => null),
      ])
      setSenders(senderList)
      setVariables(variableList)
      if (domainResult) {
        setDomainName(domainResult.domainName)
        setDomainStatus(domainResult.status)
        setDomainRecords(domainResult.records)
        setDomainInput(domainResult.domainName)
      } else {
        setDomainName(null)
        setDomainStatus(null)
        setDomainRecords([])
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar configurações")
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [masterId, teamId])

  useEffect(() => {
    if (!teamId) return
    void load()
  }, [load, refreshKey, teamId])

  const handleConnectDomain = useCallback(async () => {
    if (!teamId || connectingDomain || !domainInput.trim()) return
    setConnectingDomain(true)
    try {
      const result = await backofficeStudioEmailService.setDomain(masterId, teamId, domainInput.trim())
      setDomainName(result.domainName)
      setDomainStatus(result.status)
      setDomainRecords(result.records)
      toast.success("Domínio configurado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao conectar domínio")
    } finally {
      setConnectingDomain(false)
    }
  }, [connectingDomain, domainInput, masterId, teamId])

  const handleVerifyDomain = useCallback(async () => {
    if (!teamId || verifyingDomain) return
    setVerifyingDomain(true)
    try {
      const result = await backofficeStudioEmailService.verifyDomain(masterId, teamId)
      setDomainStatus(result.status)
      toast.success("Verificação solicitada")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao verificar domínio")
    } finally {
      setVerifyingDomain(false)
    }
  }, [load, masterId, teamId, verifyingDomain])

  const handleLoadDomainRecords = useCallback(async () => {
    if (!teamId || loadingRecords) return
    setLoadingRecords(true)
    try {
      const result = await backofficeStudioEmailService.getDomainRecords(masterId, teamId)
      setDomainName(result.domainName)
      setDomainStatus(result.status)
      setDomainRecords(result.records)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar registros DNS")
    } finally {
      setLoadingRecords(false)
    }
  }, [loadingRecords, masterId, teamId])

  const handleCreateSender = useCallback(
    async (data: UpsertStudioEmailSenderData) => {
      if (!teamId || creatingSender) return
      setCreatingSender(true)
      try {
        await backofficeStudioEmailService.createSender(masterId, teamId, data)
        toast.success("Remetente criado")
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar remetente")
      } finally {
        setCreatingSender(false)
      }
    },
    [creatingSender, load, masterId, teamId]
  )

  const handleUpdateSender = useCallback(
    async (senderId: string, data: UpsertStudioEmailSenderData) => {
      if (!teamId || updatingSenderId) return
      setUpdatingSenderId(senderId)
      try {
        await backofficeStudioEmailService.updateSender(masterId, teamId, senderId, data)
        toast.success("Remetente atualizado")
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar remetente")
      } finally {
        setUpdatingSenderId(null)
      }
    },
    [load, masterId, teamId, updatingSenderId]
  )

  const handleDeleteSender = useCallback(
    async (senderId: string) => {
      if (!teamId || deletingSenderId) return
      setDeletingSenderId(senderId)
      try {
        await backofficeStudioEmailService.deleteSender(masterId, teamId, senderId)
        toast.success("Remetente removido")
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao remover remetente")
      } finally {
        setDeletingSenderId(null)
      }
    },
    [deletingSenderId, load, masterId, teamId]
  )

  const handleSetDefaultSender = useCallback(
    async (senderId: string) => {
      if (!teamId || settingDefaultSenderId) return
      setSettingDefaultSenderId(senderId)
      try {
        await backofficeStudioEmailService.setDefaultSender(masterId, teamId, senderId)
        toast.success("Remetente padrão atualizado")
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao definir remetente padrão")
      } finally {
        setSettingDefaultSenderId(null)
      }
    },
    [load, masterId, settingDefaultSenderId, teamId]
  )

  const handleCreateVariable = useCallback(
    async (data: UpsertStudioEmailVariableData) => {
      if (!teamId || creatingVariable) return
      setCreatingVariable(true)
      try {
        await backofficeStudioEmailService.createVariable(masterId, teamId, data)
        toast.success("Variável criada")
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar variável")
      } finally {
        setCreatingVariable(false)
      }
    },
    [creatingVariable, load, masterId, teamId]
  )

  const handleUpdateVariable = useCallback(
    async (variableId: string, data: UpsertStudioEmailVariableData) => {
      if (!teamId || updatingVariableId) return
      setUpdatingVariableId(variableId)
      try {
        await backofficeStudioEmailService.updateVariable(masterId, teamId, variableId, data)
        toast.success("Variável atualizada")
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar variável")
      } finally {
        setUpdatingVariableId(null)
      }
    },
    [load, masterId, teamId, updatingVariableId]
  )

  const handleDeleteVariable = useCallback(
    async (variableId: string) => {
      if (!teamId || deletingVariableId) return
      setDeletingVariableId(variableId)
      try {
        await backofficeStudioEmailService.deleteVariable(masterId, teamId, variableId)
        toast.success("Variável removida")
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao remover variável")
      } finally {
        setDeletingVariableId(null)
      }
    },
    [deletingVariableId, load, masterId, teamId]
  )

  const handleSaveSettings = useCallback(async () => {
    if (!teamId || saving) return
    setSaving(true)
    try {
      await backofficeStudioEmailService.updateSettings(masterId, teamId, {})
      toast.success("Configurações salvas")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar configurações")
    } finally {
      setSaving(false)
    }
  }, [masterId, saving, teamId])

  return {
    loading,
    saving,
    senders,
    variables,
    domainInput,
    setDomainInput,
    domainName,
    domainStatus,
    domainRecords,
    connectingDomain,
    verifyingDomain,
    loadingRecords,
    creatingSender,
    updatingSenderId,
    deletingSenderId,
    settingDefaultSenderId,
    creatingVariable,
    updatingVariableId,
    deletingVariableId,
    handleConnectDomain,
    handleVerifyDomain,
    handleLoadDomainRecords,
    handleCreateSender,
    handleUpdateSender,
    handleDeleteSender,
    handleSetDefaultSender,
    handleCreateVariable,
    handleUpdateVariable,
    handleDeleteVariable,
    handleSaveSettings,
    refresh: load,
  }
}
