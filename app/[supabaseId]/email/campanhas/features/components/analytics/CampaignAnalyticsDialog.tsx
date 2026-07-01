"use client"

import { BarChart3, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { DeliverabilityChart } from "./DeliverabilityChart"
import { DispatchAccordionTable } from "./DispatchAccordionTable"
import { MetricsSummaryCards } from "./MetricsSummaryCards"
import { PeriodSelector } from "./PeriodSelector"
import { useCampaignAnalytics } from "./useCampaignAnalytics"

type CampaignAnalyticsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId?: string
  campaignName?: string
}

export function CampaignAnalyticsDialog({
  open,
  onOpenChange,
  campaignId,
  campaignName,
}: CampaignAnalyticsDialogProps) {
  const { data, initialLoading, refreshing, period, handlePeriodChange, handleRefresh } =
    useCampaignAnalytics(campaignId, open)

  const title = campaignName
    ? `Métricas — ${campaignName}`
    : "Métricas de E-mail"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5" />
            <DialogTitle>{title}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <PeriodSelector period={period} onPeriodChange={handlePeriodChange} />
              <p className="text-xs text-muted-foreground">
                Entrega e engajamento atualizam automaticamente a cada 30s via eventos do Resend.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw data-icon="inline-start" className={cn(refreshing && "animate-spin")} />
              Atualizar
            </Button>
          </div>
          <MetricsSummaryCards data={data} loading={initialLoading} />
          <DeliverabilityChart data={data} loading={initialLoading} />
          {campaignId ? (
            <DispatchAccordionTable
              campaignId={campaignId}
              data={data}
              loading={initialLoading}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
