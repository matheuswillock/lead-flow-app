"use client"

import { Database } from "lucide-react"
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
import { formatIntimezone } from "@/lib/dates/formatters"
import { useBackofficeBackups } from "../context/BackofficeBackupsContext"
import type { BackofficeDatabaseBackupStatus } from "../context/BackofficeBackupsTypes"

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

function statusLabel(status: BackofficeDatabaseBackupStatus) {
  switch (status) {
    case "pending":
      return "Em andamento"
    case "success":
      return "Concluído"
    case "failed":
      return "Falhou"
    default:
      return status
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
    default:
      return "secondary"
  }
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
  const { items, isLoading, isDownloading, downloadingId, error, download } = useBackofficeBackups()

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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Database className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Backups</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Histórico de backups automáticos do banco de dados. Apenas backups concluídos podem ser baixados.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
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
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                      <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                    </TableCell>
                    <TableCell>{formatBytes(item.sizeBytes)}</TableCell>
                    <TableCell className="max-w-48 truncate font-mono text-xs">
                      {item.checksumSha256 ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{item.fileName ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {item.status === "success" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isDownloading}
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
