"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { IBackofficeBackupsService } from "../services/IBackofficeBackupsService"
import { useBackofficeBackupsHook } from "./BackofficeBackupsHook"
import type { BackofficeBackupItem } from "./BackofficeBackupsTypes"

interface BackofficeBackupsContextValue {
  service: IBackofficeBackupsService
  items: BackofficeBackupItem[]
  isLoading: boolean
  isDownloading: boolean
  isGenerating: boolean
  downloadingId: string | null
  error: string | null
  refresh: (options?: { force?: boolean }) => Promise<void>
  createManualBackup: () => Promise<void>
  download: (id: string) => Promise<{ blob: Blob; fileName: string }>
}

const BackofficeBackupsContext = createContext<BackofficeBackupsContextValue | null>(null)

interface BackofficeBackupsProviderProps {
  children: React.ReactNode
  service: IBackofficeBackupsService
}

export function BackofficeBackupsProvider({
  children,
  service,
}: BackofficeBackupsProviderProps) {
  useBackofficeBackupsHook({ service })
  const [items, setItems] = useState<BackofficeBackupItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const lastSuccessRef = useRef(false)

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    if (inFlightRef.current) return
    if (!options?.force && lastSuccessRef.current) return

    inFlightRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const result = await service.list()
      setItems(result.items)
      lastSuccessRef.current = true
    } catch (err) {
      console.error("[BackofficeBackupsProvider][refresh]", err)
      setError(err instanceof Error ? err.message : "Erro ao carregar backups")
      lastSuccessRef.current = false
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [service])

  useEffect(() => {
    lastSuccessRef.current = false
    void refresh()
  }, [refresh])

  const createManualBackup = useCallback(async () => {
    if (isGenerating) {
      throw new Error("Geração de backup já em andamento")
    }
    setIsGenerating(true)
    try {
      await service.createManualBackup()
      await refresh({ force: true })
    } finally {
      setIsGenerating(false)
    }
  }, [isGenerating, refresh, service])

  const download = useCallback(
    async (id: string) => {
      if (isDownloading) {
        throw new Error("Download já em andamento")
      }
      setIsDownloading(true)
      setDownloadingId(id)
      try {
        return await service.download(id)
      } finally {
        setIsDownloading(false)
        setDownloadingId(null)
      }
    },
    [isDownloading, service]
  )

  const value = useMemo(
    () => ({
      service,
      items,
      isLoading,
      isDownloading,
      isGenerating,
      downloadingId,
      error,
      refresh,
      createManualBackup,
      download,
    }),
    [
      service,
      items,
      isLoading,
      isDownloading,
      isGenerating,
      downloadingId,
      error,
      refresh,
      createManualBackup,
      download,
    ]
  )

  return (
    <BackofficeBackupsContext.Provider value={value}>{children}</BackofficeBackupsContext.Provider>
  )
}

export function useBackofficeBackups() {
  const context = useContext(BackofficeBackupsContext)
  if (!context) {
    throw new Error("useBackofficeBackups must be used within BackofficeBackupsProvider")
  }
  return context
}
