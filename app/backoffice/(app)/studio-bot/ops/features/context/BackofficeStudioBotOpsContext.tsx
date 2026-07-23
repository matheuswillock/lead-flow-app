"use client"

import { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import type { IBackofficeStudioBotOpsService } from "../services/IBackofficeStudioBotOpsService"
import type {
  BackofficeBotHostJob,
  BackofficeBotHostSettings,
  BethaniaWebhookResyncResult,
  HostHealth,
  HostLogsResult,
} from "./BackofficeStudioBotOpsTypes"

type BackofficeStudioBotOpsContextValue = {
  settings: BackofficeBotHostSettings | null
  jobs: BackofficeBotHostJob[]
  health: HostHealth | null
  logs: HostLogsResult | null
  bethaniaWebhookResync: BethaniaWebhookResyncResult | null
  isLoading: boolean
  isLoadingLogs: boolean
  actionLock: string | null
  loadAll: () => Promise<void>
  saveSettings: (input: {
    agentBaseUrl?: string | null
    desiredHostVersion?: string | null
    n8nEnv?: Record<string, string>
    evolutionEnv?: Record<string, string>
  }) => Promise<boolean>
  exportEnvFile: () => Promise<{
    content: string
    fileName: string
    agentBaseUrl: string | null
    desiredHostVersion: string | null
    n8nEnv: Record<string, string>
    evolutionEnv: Record<string, string>
  } | null>
  rotateToken: () => Promise<string | null>
  runHealth: () => Promise<void>
  runFetchLogs: (input: { service: "n8n" | "api"; tail?: number }) => Promise<void>
  runApplyEnv: () => Promise<void>
  runRestart: (service: "n8n" | "api" | "all") => Promise<void>
  runImportWorkflows: () => Promise<void>
  previewResyncBethaniaWebhook: () => Promise<void>
  confirmResyncBethaniaWebhook: () => Promise<void>
  runSyncHost: (input: {
    version: string
    packBase64: string
    packSha256: string
  }) => Promise<void>
}

export const BackofficeStudioBotOpsContext =
  createContext<BackofficeStudioBotOpsContextValue | null>(null)

export function BackofficeStudioBotOpsProvider({
  service,
  children,
}: {
  service: IBackofficeStudioBotOpsService
  children: ReactNode
}) {
  const [settings, setSettings] = useState<BackofficeBotHostSettings | null>(null)
  const [jobs, setJobs] = useState<BackofficeBotHostJob[]>([])
  const [health, setHealth] = useState<HostHealth | null>(null)
  const [logs, setLogs] = useState<HostLogsResult | null>(null)
  const [bethaniaWebhookResync, setBethaniaWebhookResync] =
    useState<BethaniaWebhookResyncResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [actionLock, setActionLock] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const lastKeyRef = useRef<string | null>(null)

  const loadAll = useCallback(async () => {
    const key = "ops-load"
    if (inFlightRef.current && lastKeyRef.current === key) return
    inFlightRef.current = true
    lastKeyRef.current = key
    setIsLoading(true)
    try {
      const [nextSettings, nextJobs] = await Promise.all([
        service.getSettings(),
        service.listJobs(),
      ])
      setSettings(nextSettings)
      setJobs(nextJobs)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar Ops")
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [service])

  const withLock = useCallback(async (lock: string, fn: () => Promise<void>) => {
    if (actionLock) return
    setActionLock(lock)
    try {
      await fn()
    } finally {
      setActionLock(null)
    }
  }, [actionLock])

  const saveSettings = useCallback(
    async (input: {
      agentBaseUrl?: string | null
      desiredHostVersion?: string | null
      n8nEnv?: Record<string, string>
      evolutionEnv?: Record<string, string>
    }) => {
      let ok = false
      await withLock("save", async () => {
        const output = await service.updateSettings(input)
        if (!output.isValid) {
          toast.error(output.errorMessages[0] ?? "Falha ao salvar")
          return
        }
        toast.success(output.successMessages[0] ?? "Salvo")
        ok = true
        await loadAll()
      })
      return ok
    },
    [loadAll, service, withLock]
  )

  const exportEnvFile = useCallback(async () => {
    let result: {
      content: string
      fileName: string
      agentBaseUrl: string | null
      desiredHostVersion: string | null
      n8nEnv: Record<string, string>
      evolutionEnv: Record<string, string>
    } | null = null
    await withLock("export-env", async () => {
      const output = await service.exportEnvFile()
      if (!output.isValid || !output.result?.content) {
        toast.error(output.errorMessages[0] ?? "Falha ao exportar variáveis")
        return
      }
      result = output.result
      toast.success(output.successMessages[0] ?? "Variáveis exportadas")
    })
    return result
  }, [service, withLock])

  const rotateToken = useCallback(async () => {
    let token: string | null = null
    await withLock("rotate", async () => {
      const output = await service.rotateToken()
      if (!output.isValid || !output.result?.agentToken) {
        toast.error(output.errorMessages[0] ?? "Falha ao gerar token")
        return
      }
      token = output.result.agentToken
      toast.success(output.successMessages[0] ?? "Token gerado")
      await loadAll()
    })
    return token
  }, [loadAll, service, withLock])

  const runHealth = useCallback(async () => {
    await withLock("health", async () => {
      const output = await service.health()
      if (!output.isValid) {
        toast.error(output.errorMessages[0] ?? "Health falhou")
        return
      }
      setHealth(output.result?.health ?? null)
      toast.success("Health atualizado")
      await loadAll()
    })
  }, [loadAll, service, withLock])

  const runFetchLogs = useCallback(
    async (input: { service: "n8n" | "api"; tail?: number }) => {
      await withLock(`logs-${input.service}`, async () => {
        setIsLoadingLogs(true)
        try {
          const output = await service.fetchLogs(input)
          if (!output.isValid || !output.result) {
            toast.error(output.errorMessages[0] ?? "Falha ao obter logs")
            return
          }
          setLogs(output.result)
          toast.success(output.successMessages[0] ?? "Logs atualizados")
        } finally {
          setIsLoadingLogs(false)
        }
      })
    },
    [service, withLock]
  )

  const runApplyEnv = useCallback(async () => {
    await withLock("apply", async () => {
      const output = await service.applyEnv()
      if (!output.isValid) {
        toast.error(output.errorMessages[0] ?? "Apply falhou")
        return
      }
      toast.success(output.successMessages[0] ?? "Env aplicado")
      await loadAll()
    })
  }, [loadAll, service, withLock])

  const runRestart = useCallback(
    async (svc: "n8n" | "api" | "all") => {
      await withLock(`restart-${svc}`, async () => {
        const output = await service.restart(svc)
        if (!output.isValid) {
          toast.error(output.errorMessages[0] ?? "Restart falhou")
          return
        }
        toast.success(output.successMessages[0] ?? "Restart ok")
        await loadAll()
      })
    },
    [loadAll, service, withLock]
  )

  const runImportWorkflows = useCallback(async () => {
    await withLock("import", async () => {
      const output = await service.importWorkflows()
      if (!output.isValid) {
        toast.error(output.errorMessages[0] ?? "Import falhou")
        return
      }
      toast.success(output.successMessages[0] ?? "Workflows importados")
      await loadAll()
    })
  }, [loadAll, service, withLock])

  const previewResyncBethaniaWebhook = useCallback(async () => {
    await withLock("preview-bethania-webhook", async () => {
      const output = await service.previewResyncBethaniaWebhook()
      if (!output.isValid || !output.result) {
        toast.error(output.errorMessages[0] ?? "Prévia do webhook falhou")
        return
      }
      setBethaniaWebhookResync(output.result)
    })
  }, [service, withLock])

  const confirmResyncBethaniaWebhook = useCallback(async () => {
    await withLock("resync-bethania-webhook", async () => {
      const output = await service.confirmResyncBethaniaWebhook()
      if (output.result) {
        setBethaniaWebhookResync(output.result)
      }
      if (!output.isValid) {
        toast.error(output.errorMessages[0] ?? "Reaplicar webhook falhou")
        return
      }
      toast.success(output.successMessages[0] ?? "Webhook Bethânia reaplicado")
    })
  }, [service, withLock])

  const runSyncHost = useCallback(
    async (input: { version: string; packBase64: string; packSha256: string }) => {
      await withLock("sync", async () => {
        const output = await service.syncHost(input)
        if (!output.isValid) {
          toast.error(output.errorMessages[0] ?? "Sync falhou")
          return
        }
        toast.success(output.successMessages[0] ?? "Host sincronizado")
        await loadAll()
      })
    },
    [loadAll, service, withLock]
  )

  const value = useMemo(
    () => ({
      settings,
      jobs,
      health,
      logs,
      bethaniaWebhookResync,
      isLoading,
      isLoadingLogs,
      actionLock,
      loadAll,
      saveSettings,
      exportEnvFile,
      rotateToken,
      runHealth,
      runFetchLogs,
      runApplyEnv,
      runRestart,
      runImportWorkflows,
      previewResyncBethaniaWebhook,
      confirmResyncBethaniaWebhook,
      runSyncHost,
    }),
    [
      settings,
      jobs,
      health,
      logs,
      bethaniaWebhookResync,
      isLoading,
      isLoadingLogs,
      actionLock,
      loadAll,
      saveSettings,
      exportEnvFile,
      rotateToken,
      runHealth,
      runFetchLogs,
      runApplyEnv,
      runRestart,
      runImportWorkflows,
      previewResyncBethaniaWebhook,
      confirmResyncBethaniaWebhook,
      runSyncHost,
    ]
  )

  return (
    <BackofficeStudioBotOpsContext.Provider value={value}>
      {children}
    </BackofficeStudioBotOpsContext.Provider>
  )
}
