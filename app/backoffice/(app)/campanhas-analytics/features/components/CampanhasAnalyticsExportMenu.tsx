"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertCircle, Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCampanhasAnalytics } from "../context/useCampanhasAnalyticsHook"
import type { CampaignAnalyticsCsvDataset } from "../context/CampanhasAnalyticsTypes"

const EXPORT_DATASETS: { key: CampaignAnalyticsCsvDataset; label: string }[] = [
  { key: "dispatches", label: "Disparos" },
  { key: "templates", label: "Templates" },
  { key: "forms", label: "Formulários" },
  { key: "series", label: "Série diária" },
]

type DownloadTarget = CampaignAnalyticsCsvDataset | "all"

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function CampanhasAnalyticsExportMenu() {
  const { exportCsv, exportAll, exportAllRangeError } = useCampanhasAnalytics()
  const [downloadingTarget, setDownloadingTarget] = useState<DownloadTarget | null>(null)

  async function handleExport(dataset: CampaignAnalyticsCsvDataset) {
    if (downloadingTarget) return
    setDownloadingTarget(dataset)
    try {
      const { blob, filename } = await exportCsv(dataset)
      downloadBlob(blob, filename)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao exportar CSV")
    } finally {
      setDownloadingTarget(null)
    }
  }

  async function handleExportAll() {
    if (downloadingTarget || exportAllRangeError) return
    setDownloadingTarget("all")
    try {
      const { blob, filename } = await exportAll()
      downloadBlob(blob, filename)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao exportar o pacote completo")
    } finally {
      setDownloadingTarget(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8" disabled={Boolean(downloadingTarget)}>
          <Download data-icon="inline-start" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="font-medium"
          disabled={Boolean(downloadingTarget) || Boolean(exportAllRangeError)}
          onSelect={(event) => {
            event.preventDefault()
            void handleExportAll()
          }}
        >
          {downloadingTarget === "all" ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <FileSpreadsheet data-icon="inline-start" />
          )}
          Exportar tudo
        </DropdownMenuItem>
        {exportAllRangeError ? (
          <div role="alert" className="flex items-start gap-1.5 px-2 py-1.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 size-3 shrink-0" />
            <span>{exportAllRangeError}</span>
          </div>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          CSV para Excel (separador ;)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {EXPORT_DATASETS.map((dataset) => (
          <DropdownMenuItem
            key={dataset.key}
            disabled={Boolean(downloadingTarget)}
            onSelect={(event) => {
              event.preventDefault()
              void handleExport(dataset.key)
            }}
          >
            {downloadingTarget === dataset.key ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : null}
            {dataset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
