"use client"

import { Database, HardDriveDownload, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTimezone } from "@/app/context/TimezoneContext"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { useBackofficeBackups } from "../context/BackofficeBackupsContext"
import type {
  BackofficeBackupItem,
  BackofficeDatabaseBackupSource,
  BackofficeDatabaseBackupStatus,
} from "../context/BackofficeBackupsTypes"

function formatBytes(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return "—"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "—"
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 0) return "—"
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function statusLabel(status: BackofficeDatabaseBackupStatus) {
  switch (status) {
    case "pending":
      return "Em andamento"
    case "success":
      return "Concluído"
    case "failed":
      return "Falhou"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function statusVariant(status: BackofficeDatabaseBackupStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "pending":
      return "outline"
    case "success":
      return "default"
    case "failed":
      return "destructive"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function sourceLabel(source: BackofficeDatabaseBackupSource) {
  switch (source) {
    case "cron":
      return "Automático (cron)"
    case "manual":
      return "Manual"
    default: {
      const _exhaustive: never = source
      return _exhaustive
    }
  }
}

function sourceVariant(source: BackofficeDatabaseBackupSource): "secondary" | "outline" {
  switch (source) {
    case "cron":
      return "secondary"
    case "manual":
      return "outline"
    default: {
      const _exhaustive: never = source
      return _exhaustive
    }
  }
}

function LogCell({ item }: { item: BackofficeBackupItem }) {
  if (item.status === "pending") {
    return <span className="text-xs text-muted-foreground">Em andamento...</span>
  }
  if (item.status === "failed") {
    const message = item.errorMessage ?? "—"
    const truncated = message.length > 80 ? `${message.slice(0, 80)}…` : message
    return (
      <span className="text-xs text-destructive" title={message}>
        {truncated}
      </span>
    )
  }
  if (item.status === "success") {
    return (
      <span className="text-xs text-muted-foreground">
        {formatDuration(item.startedAt, item.finishedAt)}
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground">—</span>
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function BackofficeBackupsContainer() {
  const { tz } = useTimezone()
  const { user } = useBackofficeUser()
  const canManageBackups = !user?.isOperator
  const {
    items,
    isLoading,
    isDownloading,
    isGenerating,
    downloadingId,
    error,
    refresh,
    createManualBackup,
    download,
  } = useBackofficeBackups()

  const hasPending = items.some((item) => item.status === "pending")
  const generateDisabled = !canManageBackups || isGenerating || isLoading || hasPending

  async function handleDownload(id: string) {
    if (isDownloading) return
    try {
      const result = await download(id)
      triggerBrowserDownload(result.blob, result.fileName)
      toast.success("Download iniciado")
    } catch (err) {
      console.error("[BackofficeBackupsContainer][handleDownload]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao baixar backup")
    }
  }

  async function handleGenerate() {
    if (generateDisabled) return
    try {
      await createManualBackup()
      toast.success("Backup gerado com sucesso")
    } catch (err) {
      console.error("[BackofficeBackupsContainer][handleGenerate]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao gerar backup")
      await refresh({ force: true })
    }
  }

  async function handleRefresh() {
    if (isGenerating) return
    try {
      await refresh({ force: true })
    } catch (err) {
      console.error("[BackofficeBackupsContainer][handleRefresh]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar lista")
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Database className="size-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">Backups</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Histórico de backups do banco de dados (automáticos e manuais). Apenas backups
            concluídos podem ser baixados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isGenerating || isLoading}
            onClick={() => void handleRefresh()}
          >
            <RefreshCw data-icon="inline-start" />
            Atualizar
          </Button>
          {canManageBackups ? (
            <Button
              type="button"
              size="sm"
              disabled={generateDisabled}
              onClick={() => void handleGenerate()}
            >
              <HardDriveDownload data-icon="inline-start" />
              {isGenerating ? "Gerando…" : "Gerar backup"}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Log</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Checksum (SHA-256)</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhum backup encontrado.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const date = item.finishedAt ?? item.startedAt
                const isPendingDownload = isDownloading && downloadingId === item.id

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {formatIntimezone(new Date(date), "dd/MM/yyyy HH:mm", tz)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sourceVariant(item.source)}>
                        {sourceLabel(item.source)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-64">
                      <LogCell item={item} />
                    </TableCell>
                    <TableCell>{formatBytes(item.sizeBytes)}</TableCell>
                    <TableCell className="max-w-48 truncate font-mono text-xs">
                      {item.checksumSha256 ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{item.fileName ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {item.status === "success" && canManageBackups ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isDownloading || isGenerating}
                          onClick={() => void handleDownload(item.id)}
                        >
                          {isPendingDownload ? "Baixando…" : "Baixar"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
