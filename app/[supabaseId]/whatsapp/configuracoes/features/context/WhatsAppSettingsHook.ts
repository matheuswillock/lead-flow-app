"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTeamContext } from '@/app/context/TeamContext'
import { whatsAppSettingsService } from '../services/WhatsAppSettingsService'
import type { WhatsAppConfig, WhatsAppSettingsContextValue, WhatsAppUsage } from './WhatsAppSettingsTypes'

const buildRequestKey = (teamId: string): string => `whatsapp-settings:${teamId}`

const QR_POLL_INTERVAL_MS = 8000
const QR_POLL_MAX_TICKS = 30 // ~4 minutes before backing off

export function useWhatsAppSettings(supabaseId: string): WhatsAppSettingsContextValue {
  const { activeTeamId } = useTeamContext()

  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [usage, setUsage] = useState<WhatsAppUsage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const inFlightKeyRef = useRef<string | null>(null)
  const lastSuccessKeyRef = useRef<string | null>(null)
  const currentKeyRef = useRef<string | null>(null)
  const lastQrCodeTextRef = useRef<string | null>(null)

  const loadData = useCallback(async () => {
    if (!activeTeamId) {
      currentKeyRef.current = null
      inFlightKeyRef.current = null
      lastSuccessKeyRef.current = null
      setConfig(null)
      setUsage(null)
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
    } catch (error) {
      if (currentKeyRef.current === requestKey) {
        setConfig(null)
        setUsage(null)
      }
      console.error('[useWhatsAppSettings] Erro ao carregar configuração:', error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar a configuração do WhatsApp')
    } finally {
      if (currentKeyRef.current === requestKey) setIsLoading(false)
      if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = null
    }
  }, [activeTeamId, supabaseId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const reload = useCallback(() => {
    lastSuccessKeyRef.current = null
    void loadData()
  }, [loadData])

  // Poll only connection status (GET config syncs with Evolution without regenerating QR).
  const status = config?.status
  useEffect(() => {
    if (status !== 'QR_READY' && status !== 'PENDING') return

    let ticks = 0
    const intervalId = window.setInterval(() => {
      ticks += 1
      if (ticks > QR_POLL_MAX_TICKS) {
        window.clearInterval(intervalId)
        return
      }
      reload()
    }, QR_POLL_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [status, reload])

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

  const connect = useCallback(async () => {
    if (!activeTeamId) {
      toast.error('Selecione um time para conectar o WhatsApp')
      return
    }
    setIsConnecting(true)
    try {
      const result = await whatsAppSettingsService.createConfig(activeTeamId, supabaseId)
      setConfig(result)
      lastSuccessKeyRef.current = null
      if (result.status === 'CONNECTED') {
        toast.success('WhatsApp conectado com sucesso')
      } else {
        toast.success('Integração iniciada. Escaneie o QR Code para conectar.')
      }
    } catch (error) {
      console.error('[useWhatsAppSettings] Erro ao conectar:', error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível conectar o WhatsApp')
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
      toast.success('QR Code atualizado com sucesso')
    } catch (error) {
      console.error('[useWhatsAppSettings] Erro ao reconectar:', error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível reconectar o WhatsApp')
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
      toast.success('WhatsApp desconectado com sucesso')
    } catch (error) {
      console.error('[useWhatsAppSettings] Erro ao desconectar:', error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível desconectar o WhatsApp')
    } finally {
      setIsDisconnecting(false)
    }
  }, [activeTeamId, supabaseId])

  return {
    config,
    usage,
    isLoading,
    isConnecting,
    isReconnecting,
    isDisconnecting,
    connect,
    reconnect,
    disconnect,
    reload,
  }
}
