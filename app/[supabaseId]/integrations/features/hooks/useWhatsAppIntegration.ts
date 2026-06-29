"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useTeamContext } from "@/app/context/TeamContext"
import { useIntegrationsContext } from "../context/IntegrationsContext"
import { whatsAppIntegrationService } from "../services/WhatsAppIntegrationService"
import type { WhatsAppConfig, WhatsAppUsage } from "../services/IWhatsAppIntegrationService"

interface UseWhatsAppIntegrationState {
  config: WhatsAppConfig | null
  usage: WhatsAppUsage | null
  isLoading: boolean
  isConnecting: boolean
  isReconnecting: boolean
  isDisconnecting: boolean
}

interface UseWhatsAppIntegrationActions {
  connect: () => Promise<void>
  reconnect: () => Promise<void>
  disconnect: () => Promise<void>
}

export type UseWhatsAppIntegrationReturn = UseWhatsAppIntegrationState & UseWhatsAppIntegrationActions

const buildRequestKey = (teamId: string): string => `whatsapp:${teamId}`

export function useWhatsAppIntegration(): UseWhatsAppIntegrationReturn {
  const { activeTeamId } = useTeamContext()
  const { supabaseId } = useIntegrationsContext()

  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [usage, setUsage] = useState<WhatsAppUsage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const inFlightKeyRef = useRef<string | null>(null)
  const lastSuccessKeyRef = useRef<string | null>(null)
  const currentKeyRef = useRef<string | null>(null)

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

    if (lastSuccessKeyRef.current === requestKey) {
      return
    }

    if (inFlightKeyRef.current === requestKey) {
      return
    }

    setIsLoading(true)
    inFlightKeyRef.current = requestKey

    try {
      const [fetchedConfig, fetchedUsage] = await Promise.all([
        whatsAppIntegrationService.fetchConfig(activeTeamId, supabaseId),
        whatsAppIntegrationService.fetchUsage(activeTeamId, supabaseId),
      ])

      if (currentKeyRef.current !== requestKey) {
        return
      }

      setConfig(fetchedConfig)
      setUsage(fetchedUsage)
      lastSuccessKeyRef.current = requestKey
    } catch (error) {
      if (currentKeyRef.current === requestKey) {
        setConfig(null)
        setUsage(null)
      }
      console.error("[useWhatsAppIntegration] Erro ao carregar configuração do WhatsApp:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar a configuração do WhatsApp")
    } finally {
      if (currentKeyRef.current === requestKey) {
        setIsLoading(false)
      }
      if (inFlightKeyRef.current === requestKey) {
        inFlightKeyRef.current = null
      }
    }
  }, [activeTeamId, supabaseId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const connect = useCallback(async () => {
    if (!activeTeamId) {
      toast.error("Selecione um time para conectar o WhatsApp")
      return
    }

    setIsConnecting(true)
    try {
      const result = await whatsAppIntegrationService.createConfig(activeTeamId, supabaseId)
      setConfig(result)
      lastSuccessKeyRef.current = null
      toast.success("WhatsApp conectado com sucesso")
    } catch (error) {
      console.error("[useWhatsAppIntegration] Erro ao conectar WhatsApp:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível conectar o WhatsApp")
    } finally {
      setIsConnecting(false)
    }
  }, [activeTeamId, supabaseId])

  const reconnect = useCallback(async () => {
    if (!activeTeamId) {
      toast.error("Selecione um time para reconectar o WhatsApp")
      return
    }

    setIsReconnecting(true)
    try {
      const result = await whatsAppIntegrationService.reconnect(activeTeamId, supabaseId)
      setConfig(result)
      lastSuccessKeyRef.current = null
      toast.success("WhatsApp reconectado com sucesso")
    } catch (error) {
      console.error("[useWhatsAppIntegration] Erro ao reconectar WhatsApp:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível reconectar o WhatsApp")
    } finally {
      setIsReconnecting(false)
    }
  }, [activeTeamId, supabaseId])

  const disconnect = useCallback(async () => {
    if (!activeTeamId) {
      toast.error("Selecione um time para desconectar o WhatsApp")
      return
    }

    setIsDisconnecting(true)
    try {
      const result = await whatsAppIntegrationService.disconnect(activeTeamId, supabaseId)
      setConfig(result)
      setUsage(null)
      lastSuccessKeyRef.current = null
      toast.success("WhatsApp desconectado com sucesso")
    } catch (error) {
      console.error("[useWhatsAppIntegration] Erro ao desconectar WhatsApp:", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível desconectar o WhatsApp")
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
  }
}
