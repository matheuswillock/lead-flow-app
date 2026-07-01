"use client"

import { BarChart3 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  const { data, loading, period, handlePeriodChange } = useCampaignAnalytics(
    campaignId,
    open
  )

  const title = campaignName
    ? `Analytics — ${campaignName}`
    : "Analytics de E-mail"

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
          <PeriodSelector period={period} onPeriodChange={handlePeriodChange} />
          <MetricsSummaryCards data={data} loading={loading} />
          <DeliverabilityChart data={data} loading={loading} />
          {campaignId ? (
            <DispatchAccordionTable
              campaignId={campaignId}
              data={data}
              loading={loading}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
