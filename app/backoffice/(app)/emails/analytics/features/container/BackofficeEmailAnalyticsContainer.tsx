"use client"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useBackofficeEmailAnalytics } from "../context/BackofficeEmailAnalyticsHook"
import { PeriodSelector } from "../components/PeriodSelector"
import { MetricsSummaryCards } from "../components/MetricsSummaryCards"
import { DeliverabilityChart } from "../components/DeliverabilityChart"
import { DispatchBreakdownTable } from "../components/DispatchBreakdownTable"

export function BackofficeEmailAnalyticsContainer() {
  const {
    data,
    campaignOptions,
    period,
    campaignId,
    isLoading,
    isRefreshing,
    setPeriod,
    setCampaignId,
    refresh,
  } = useBackofficeEmailAnalytics()

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Métricas de entrega e engajamento das campanhas de e-mail do Backoffice.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelector period={period} onPeriodChange={setPeriod} />
            <Select
              value={campaignId ?? "all"}
              onValueChange={(value) => setCampaignId(value === "all" ? undefined : value)}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Todas as campanhas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as campanhas</SelectItem>
                {campaignOptions.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Entrega e engajamento atualizam automaticamente a cada 30s via eventos do Resend.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
          <RefreshCw data-icon="inline-start" className={cn(isRefreshing && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      <MetricsSummaryCards data={data} loading={isLoading} />
      <DeliverabilityChart data={data} loading={isLoading} />
      {campaignId ? <DispatchBreakdownTable data={data} loading={isLoading} /> : null}
    </div>
  )
}
