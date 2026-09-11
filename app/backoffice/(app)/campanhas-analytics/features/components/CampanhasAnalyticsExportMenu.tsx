"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Download, Loader2 } from "lucide-react"
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
  const { exportCsv } = useCampanhasAnalytics()
  const [downloadingDataset, setDownloadingDataset] = useState<CampaignAnalyticsCsvDataset | null>(null)

  async function handleExport(dataset: CampaignAnalyticsCsvDataset) {
    if (downloadingDataset) return
    setDownloadingDataset(dataset)
    try {
      const { blob, filename } = await exportCsv(dataset)
      downloadBlob(blob, filename)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao exportar CSV")
    } finally {
      setDownloadingDataset(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8" disabled={Boolean(downloadingDataset)}>
          <Download data-icon="inline-start" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          CSV para Excel (separador ;)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {EXPORT_DATASETS.map((dataset) => (
          <DropdownMenuItem
            key={dataset.key}
            disabled={Boolean(downloadingDataset)}
            onSelect={(event) => {
              event.preventDefault()
              void handleExport(dataset.key)
            }}
          >
            {downloadingDataset === dataset.key ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : null}
            {dataset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
