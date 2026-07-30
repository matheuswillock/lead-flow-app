"use client"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DeliverabilityChart } from "@/app/[supabaseId]/email/campanhas/features/components/analytics/DeliverabilityChart"
import { MetricsSummaryCards } from "@/app/[supabaseId]/email/campanhas/features/components/analytics/MetricsSummaryCards"
import { PeriodSelector } from "@/app/[supabaseId]/email/campanhas/features/components/analytics/PeriodSelector"
import { useCampaignAnalytics } from "@/app/[supabaseId]/email/campanhas/features/components/analytics/useCampaignAnalytics"

export function BackofficeEmailMetricsContainer() {
  const { data, initialLoading, refreshing, period, handlePeriodChange, handleRefresh } =
    useCampaignAnalytics(undefined, true)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <PeriodSelector period={period} onPeriodChange={handlePeriodChange} />
          <p className="text-xs text-muted-foreground">
            Métricas agregadas do time selecionado.
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
    </div>
  )
}
