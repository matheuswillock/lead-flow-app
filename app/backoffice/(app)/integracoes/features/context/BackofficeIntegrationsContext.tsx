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
import { toUserToastMessage, toastUserError } from "@/lib/ui/to-user-toast-message"
import type { IBackofficeIntegrationsService } from "../services/IBackofficeIntegrationsService"
import type {
  BackofficeMetaIntegrationConfig,
  BackofficeMetaWebhookRequestLogItem,
  BackofficeMetaWebhookTokenHistoryItem,
  BackofficeWebhookTokenExpiryMode,
} from "./BackofficeIntegrationsTypes"

export interface BackofficeIntegrationsContextValue {
  metaConfig: BackofficeMetaIntegrationConfig | null
  metaLogs: BackofficeMetaWebhookRequestLogItem[]
  metaTokenHistory: BackofficeMetaWebhookTokenHistoryItem[]
  tokenExpiryMode: BackofficeWebhookTokenExpiryMode
  isLoading: boolean
  isGeneratingToken: boolean
  isLoadingLogs: boolean
  error: string | null
  setTokenExpiryMode: (mode: BackofficeWebhookTokenExpiryMode) => void
  refresh: () => Promise<void>
  refreshLogs: () => Promise<void>
  generateMetaToken: () => Promise<void>
}

export const BackofficeIntegrationsContext = createContext<
  BackofficeIntegrationsContextValue | undefined
>(undefined)

interface ProviderProps {
  children: ReactNode
  service: IBackofficeIntegrationsService
}

export function BackofficeIntegrationsProvider({ children, service }: ProviderProps) {
  const [metaConfig, setMetaConfig] = useState<BackofficeMetaIntegrationConfig | null>(null)
  const [metaLogs, setMetaLogs] = useState<BackofficeMetaWebhookRequestLogItem[]>([])
  const [metaTokenHistory, setMetaTokenHistory] = useState<BackofficeMetaWebhookTokenHistoryItem[]>([])
  const [tokenExpiryMode, setTokenExpiryMode] =
    useState<BackofficeWebhookTokenExpiryMode>("indeterminate")
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingToken, setIsGeneratingToken] = useState(false)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const logsInFlightRef = useRef(false)
  const generateInFlightRef = useRef(false)

  const refreshLogs = useCallback(async () => {
    if (logsInFlightRef.current) return
    logsInFlightRef.current = true
    setIsLoadingLogs(true)
    try {
      const logs = await service.listMetaLogs(15)
      setMetaLogs(logs)
    } catch (err) {
      console.error("[BackofficeIntegrationsContext][refreshLogs]", err)
      toastUserError(err)
    } finally {
      setIsLoadingLogs(false)
      logsInFlightRef.current = false
    }
  }, [service])

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsLoading(true)
    setError(null)
    try {
      const [config, logs, tokenHistory] = await Promise.all([
        service.getMetaConfig(),
        service.listMetaLogs(15),
        service.listMetaTokenHistory(15),
      ])
      setMetaConfig(config)
      setMetaLogs(logs)
      setMetaTokenHistory(tokenHistory)
      setTokenExpiryMode(config.expiryMode)
    } catch (err) {
      console.error("[BackofficeIntegrationsContext][refresh]", err)
      setError(toUserToastMessage(err))
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [service])

  const generateMetaToken = useCallback(async () => {
    if (generateInFlightRef.current) return
    generateInFlightRef.current = true
    setIsGeneratingToken(true)
    try {
      const config = await service.generateMetaToken(tokenExpiryMode)
      setMetaConfig(config)
      setTokenExpiryMode(config.expiryMode)
      toast.success("Token do webhook gerado")
      const [logs, tokenHistory] = await Promise.all([
        service.listMetaLogs(15),
        service.listMetaTokenHistory(15),
      ])
      setMetaLogs(logs)
      setMetaTokenHistory(tokenHistory)
    } catch (err) {
      console.error("[BackofficeIntegrationsContext][generateMetaToken]", err)
      toastUserError(err)
    } finally {
      setIsGeneratingToken(false)
      generateInFlightRef.current = false
    }
  }, [service, tokenExpiryMode])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<BackofficeIntegrationsContextValue>(
    () => ({
      metaConfig,
      metaLogs,
      metaTokenHistory,
      tokenExpiryMode,
      isLoading,
      isGeneratingToken,
      isLoadingLogs,
      error,
      setTokenExpiryMode,
      refresh,
      refreshLogs,
      generateMetaToken,
    }),
    [
      metaConfig,
      metaLogs,
      metaTokenHistory,
      tokenExpiryMode,
      isLoading,
      isGeneratingToken,
      isLoadingLogs,
      error,
      refresh,
      refreshLogs,
      generateMetaToken,
    ]
  )

  return (
    <BackofficeIntegrationsContext.Provider value={value}>
      {children}
    </BackofficeIntegrationsContext.Provider>
  )
}
