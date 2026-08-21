"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { toUserToastMessage, toastUserError } from '@/lib/ui/to-user-toast-message'
import { useTeamContext } from '@/app/context/TeamContext'
import { isManagerLikeRole } from '@/lib/roles'
import { dispatchWhatsAppConfigChanged } from '@/lib/whatsapp/unread-events'
import { whatsAppSettingsService } from '../services/WhatsAppSettingsService'
import type { WhatsAppConfig, WhatsAppSettingsContextValue, WhatsAppUsage, ReusableWhatsAppNumber } from './WhatsAppSettingsTypes'

const buildRequestKey = (teamId: string): string => `whatsapp-settings:${teamId}`

const QR_POLL_INTERVAL_MS = 5000
const QR_POLL_MAX_TICKS = 30
const QR_GEN_MAX_ATTEMPTS = 5
const QR_GEN_BASE_DELAY_MS = 3000
const QR_GEN_MAX_DELAY_MS = 15000

export function useWhatsAppSettings(supabaseId: string): WhatsAppSettingsContextValue {
  const router = useRouter()
  const { activeTeamId, isTeamMaster, activeTeam } = useTeamContext()
  const canManageInfrastructure = isTeamMaster || isManagerLikeRole(activeTeam?.role)

  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [usage, setUsage] = useState<WhatsAppUsage | null>(null)
  const [reusableNumbers, setReusableNumbers] = useState<ReusableWhatsAppNumber[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingReusableNumbers, setIsLoadingReusableNumbers] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isSyncingContacts, setIsSyncingContacts] = useState(false)
  const [isPurgingConversations, setIsPurgingConversations] = useState(false)

  const inFlightKeyRef = useRef<string | null>(null)
  const pollInFlightRef = useRef(false)
  const lastSuccessKeyRef = useRef<string | null>(null)
  const currentKeyRef = useRef<string | null>(null)
  const lastQrCodeTextRef = useRef<string | null>(null)
  const prevStatusRef = useRef<WhatsAppConfig['status'] | null>(null)
  const qrGenInFlightRef = useRef(false)
  const qrGenAttemptsRef = useRef(0)

  const loadData = useCallback(async () => {
    if (!activeTeamId) {
      currentKeyRef.current = null
      inFlightKeyRef.current = null
      lastSuccessKeyRef.current = null
      setConfig(null)
      setUsage(null)
      setReusableNumbers([])
      setIsLoading(false)
      return
    }

    const requestKey = buildRequestKey(activeTeamId)
    currentKeyRef.current = requestKey

    if (lastSuccessKeyRef.current === requestKey) return
    if (inFlightKeyRef.current === requestKey) return

    setIsLoading(true)
    inFlightKeyRef.current = requestKey

    try {
      const [fetchedConfig, fetchedUsage] = await Promise.all([
        whatsAppSettingsService.fetchConfig(activeTeamId, supabaseId),
        whatsAppSettingsService.fetchUsage(activeTeamId, supabaseId),
      ])

      if (currentKeyRef.current !== requestKey) return

      setConfig(fetchedConfig)
      setUsage(fetchedUsage)
      lastSuccessKeyRef.current = requestKey

      if (isTeamMaster && !fetchedConfig) {
        setIsLoadingReusableNumbers(true)
        try {
          const numbers = await whatsAppSettingsService.fetchReusableNumbers(activeTeamId, supabaseId)
          if (currentKeyRef.current === requestKey) {
            setReusableNumbers(numbers)
          }
        } catch (error) {
          console.error('[useWhatsAppSettings] Erro ao carregar números reutilizáveis:', error)
        } finally {
          if (currentKeyRef.current === requestKey) setIsLoadingReusableNumbers(false)
        }
      } else if (currentKeyRef.current === requestKey) {
        setReusableNumbers([])
      }
    } catch (error) {
      if (currentKeyRef.current === requestKey) {
        setConfig(null)
        setUsage(null)
      }
      console.error('[useWhatsAppSettings] Erro ao carregar configuração:', error)
      toastUserError(error)
    } finally {
      if (currentKeyRef.current === requestKey) setIsLoading(false)
      if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = null
    }
  }, [activeTeamId, supabaseId, isTeamMaster])

  const refreshConfig = useCallback(async () => {
    if (!activeTeamId || pollInFlightRef.current) return

    pollInFlightRef.current = true
    setIsRefreshing(true)

    try {
      const fetchedConfig = await whatsAppSettingsService.fetchConfig(activeTeamId, supabaseId)
      setConfig(fetchedConfig)
    } catch (error) {
      console.error('[useWhatsAppSettings] Erro ao atualizar status:', error)
    } finally {
      setIsRefreshing(false)
      pollInFlightRef.current = false
    }
  }, [activeTeamId, supabaseId])

  const generateQrSilently = useCallback(async () => {
    if (!activeTeamId || qrGenInFlightRef.current) return

    qrGenInFlightRef.current = true
    try {
      const result = await whatsAppSettingsService.reconnect(activeTeamId, supabaseId)
      setConfig(result)
      lastSuccessKeyRef.current = null
      dispatchWhatsAppConfigChanged()
    } catch (error) {
      console.error('[useWhatsAppSettings] Erro ao gerar QR Code automaticamente:', error)
    } finally {
      qrGenInFlightRef.current = false
    }
  }, [activeTeamId, supabaseId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const reload = useCallback(() => {
    lastSuccessKeyRef.current = null
    void loadData()
  }, [loadData])

  const status = config?.status
  useEffect(() => {
    const shouldPollForQr = status === 'QR_READY' || status === 'PENDING' || status === 'INITIALIZING'

    if (!shouldPollForQr) return

    let ticks = 0
    const intervalId = window.setInterval(() => {
      ticks += 1
      if (ticks > QR_POLL_MAX_TICKS) {
        window.clearInterval(intervalId)
        return
      }
      void refreshConfig()
    }, QR_POLL_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [status, refreshConfig])

  const hasQrImage = Boolean(config?.qrCodeImageUrl)
  const isSharedConfig = Boolean(config?.primaryConfigId)
  useEffect(() => {
    const needsQrGeneration =
      status === 'DISCONNECTED' &&
      !hasQrImage &&
      !isSharedConfig &&
      canManageInfrastructure

    if (!needsQrGeneration) {
      qrGenAttemptsRef.current = 0
      return
    }

    let cancelled = false
    let timerId: number | null = null

    const attempt = () => {
      if (cancelled || qrGenAttemptsRef.current >= QR_GEN_MAX_ATTEMPTS) return
      qrGenAttemptsRef.current += 1
      void generateQrSilently().finally(() => {
        if (cancelled) return
        const delay = Math.min(
          QR_GEN_BASE_DELAY_MS * 2 ** (qrGenAttemptsRef.current - 1),
          QR_GEN_MAX_DELAY_MS
        )
        timerId = window.setTimeout(attempt, delay)
      })
    }

    attempt()

    return () => {
      cancelled = true
      if (timerId !== null) window.clearTimeout(timerId)
    }
  }, [status, hasQrImage, isSharedConfig, canManageInfrastructure, generateQrSilently])

  useEffect(() => {
    const qrCodeText = config?.qrCodeText
    if (!qrCodeText) {
      lastQrCodeTextRef.current = null
      return
    }
    if (lastQrCodeTextRef.current && lastQrCodeTextRef.current !== qrCodeText) {
      toast.info('QR Code atualizado. Escaneie o código mais recente em até 60 segundos.')
    }
    lastQrCodeTextRef.current = qrCodeText
  }, [config?.qrCodeText])

  useEffect(() => {
    const prev = prevStatusRef.current
    const current = config?.status ?? null
    prevStatusRef.current = current

    if (!activeTeamId) return
    if (!prev || (prev !== 'QR_READY' && prev !== 'PENDING' && prev !== 'INITIALIZING')) return
    if (current !== 'CONNECTED') return

    toast.success('WhatsApp conectado com sucesso')
    dispatchWhatsAppConfigChanged()
    void whatsAppSettingsService.syncHistory(activeTeamId, supabaseId).catch((error) => {
      console.error('[useWhatsAppSettings] Erro ao sincronizar histórico:', error)
    })
    router.push(`/${supabaseId}/whatsapp`)
  }, [config?.status, activeTeamId, supabaseId, router])

  const connect = useCallback(async (reuseFromTeamId?: string) => {
    if (!activeTeamId) {
      toast.error('Selecione um time para conectar o WhatsApp')
      return
    }
    setIsConnecting(true)
    try {
      const result = await whatsAppSettingsService.createConfig(activeTeamId, supabaseId, {
        reuseFromTeamId,
      })
      setConfig(result)
      lastSuccessKeyRef.current = null
      dispatchWhatsAppConfigChanged()
      if (result.status === 'CONNECTED') {
        toast.success(
          reuseFromTeamId
            ? 'Número compartilhado vinculado com sucesso'
            : 'WhatsApp conectado com sucesso'
        )
      } else {
        toast.success(
          reuseFromTeamId
            ? 'Número compartilhado vinculado ao time'
            : 'Integração iniciada. Escaneie o QR Code para conectar.'
        )
      }
    } catch (error) {
      console.error('[useWhatsAppSettings] Erro ao conectar:', error)
      toastUserError(error)
    } finally {
      setIsConnecting(false)
    }
  }, [activeTeamId, supabaseId])

  const reconnect = useCallback(async () => {
    if (!activeTeamId) {
      toast.error('Selecione um time para reconectar o WhatsApp')
      return
    }
    setIsReconnecting(true)
    try {
      const result = await whatsAppSettingsService.reconnect(activeTeamId, supabaseId)
      setConfig(result)
      lastSuccessKeyRef.current = null
      dispatchWhatsAppConfigChanged()
      toast.success('QR Code atualizado com sucesso')
    } catch (error) {
      console.error('[useWhatsAppSettings] Erro ao reconectar:', error)
      toastUserError(error)
    } finally {
      setIsReconnecting(false)
    }
  }, [activeTeamId, supabaseId])

  const disconnect = useCallback(async () => {
    if (!activeTeamId) {
      toast.error('Selecione um time para desconectar o WhatsApp')
      return
    }
    setIsDisconnecting(true)
    try {
      const result = await whatsAppSettingsService.disconnect(activeTeamId, supabaseId)
      setConfig(result)
      setUsage(null)
      lastSuccessKeyRef.current = null
      dispatchWhatsAppConfigChanged()
      if (result.status === 'QR_READY' && result.qrCodeImageUrl) {
        toast.success('WhatsApp desconectado. Escaneie o novo QR Code para reconectar.')
      } else if (result.status === 'DISCONNECTED') {
        toast.success('WhatsApp desconectado. Gerando QR Code para reconexão...')
        void refreshConfig()
      } else {
        toast.success('WhatsApp desconectado com sucesso')
      }
    } catch (error) {
      console.error('[useWhatsAppSettings] Erro ao desconectar:', error)
      const message = toUserToastMessage(error)
      if (message.includes('já está desconectado')) {
        toast.info(message)
        void refreshConfig()
        return
      }
      toast.error(message)
    } finally {
      setIsDisconnecting(false)
    }
  }, [activeTeamId, supabaseId, refreshConfig])

  const syncPhoneContacts = useCallback(async () => {
    if (!activeTeamId) {
      toast.error('Selecione um time para sincronizar os contatos')
      return
    }
    if (isSyncingContacts) return
    setIsSyncingContacts(true)
    try {
      const result = await whatsAppSettingsService.syncPhoneContacts(activeTeamId, supabaseId)
      toast.success(
        `${result.imported} contato(s) importado(s), ${result.updatedConversations} conversa(s) atualizada(s)`
      )
    } catch (error) {
      console.error('[useWhatsAppSettings] Erro ao sincronizar contatos:', error)
      toastUserError(error)
    } finally {
      setIsSyncingContacts(false)
    }
  }, [activeTeamId, supabaseId, isSyncingContacts])

  const purgeConversations = useCallback(async () => {
    if (!activeTeamId) {
      toast.error('Selecione um time para zerar as conversas')
      return
    }
    if (isPurgingConversations) return
    setIsPurgingConversations(true)
    try {
      const result = await whatsAppSettingsService.purgeConversations(activeTeamId, supabaseId)
      dispatchWhatsAppConfigChanged()
      toast.success(
        result.deletedCount === 0
          ? 'Nenhuma conversa ativa para remover'
          : `${result.deletedCount} conversa(s) removida(s) com sucesso`
      )
    } catch (error) {
      console.error('[useWhatsAppSettings] Erro ao zerar conversas:', error)
      toastUserError(error)
    } finally {
      setIsPurgingConversations(false)
    }
  }, [activeTeamId, supabaseId, isPurgingConversations])

  return {
    config,
    usage,
    reusableNumbers,
    isLoading,
    isLoadingReusableNumbers,
    isRefreshing,
    isConnecting,
    isReconnecting,
    isDisconnecting,
    isSyncingContacts,
    isPurgingConversations,
    connect,
    reconnect,
    disconnect,
    reload,
    syncPhoneContacts,
    purgeConversations,
  }
}
