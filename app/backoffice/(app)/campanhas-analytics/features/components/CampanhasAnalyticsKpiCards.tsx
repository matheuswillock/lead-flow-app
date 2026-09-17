"use client"

import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampanhasAnalytics } from "../context/useCampanhasAnalyticsHook"
import {
  formatCampaignAnalyticsInteger,
  formatCampaignAnalyticsRate,
  formatCampaignAnalyticsScore,
} from "../utils/campaignAnalyticsFormatters"
import type { CampaignAnalyticsSummary } from "../context/CampanhasAnalyticsTypes"

type KpiDefinition = {
  key: string
  label: string
  value: string
  base: string
}

// Sem "entrega %": o backend não expõe deliveryRate (ver "A confirmar" na SPEC
// 11) e calcular delivered/sent no front violaria o non-goal "zero número
// calculado no front".
function buildKpis(summary: CampaignAnalyticsSummary): KpiDefinition[] {
  return [
    { key: "dispatches", label: "Disparos", value: formatCampaignAnalyticsInteger(summary.totals.dispatches), base: "no período" },
    { key: "failed", label: "Falhas", value: formatCampaignAnalyticsInteger(summary.totals.failed), base: "disparos com erro" },
    { key: "sent", label: "Enviados", value: formatCampaignAnalyticsInteger(summary.totals.sent), base: "e-mails enviados" },
    { key: "delivered", label: "Entregues", value: formatCampaignAnalyticsInteger(summary.totals.delivered), base: "e-mails entregues" },
    { key: "openRate", label: "Abertura", value: formatCampaignAnalyticsRate(summary.rates.openRate), base: "aberturas ÷ enviados" },
    { key: "clicked", label: "Cliques", value: formatCampaignAnalyticsInteger(summary.totals.clicked), base: "cliques totais" },
    { key: "bounced", label: "Bounces", value: formatCampaignAnalyticsInteger(summary.totals.bounced), base: "e-mails rejeitados" },
    { key: "finalScore", label: "Nota Final", value: formatCampaignAnalyticsScore(summary.rates.finalScore), base: "leads por 1.000 enviados" },
    { key: "leadsCreated", label: "Leads criados", value: formatCampaignAnalyticsInteger(summary.totals.leadsCreated), base: "card novo no CRM" },
    { key: "leadsAttached", label: "Leads anexados", value: formatCampaignAnalyticsInteger(summary.totals.leadsAttached), base: "resposta somada a card existente" },
    { key: "leadsTotal", label: "Leads totais", value: formatCampaignAnalyticsInteger(summary.totals.leadsTotal), base: "e-mail + formulário, no período" },
  ]
}

export function CampanhasAnalyticsKpiCards() {
  const { summary, summaryError, isUpdating, retry } = useCampanhasAnalytics()

  if (summaryError) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        <span className="inline-flex items-center gap-2">
          <AlertCircle className="size-4" />
          {summaryError}
        </span>
        <Button size="sm" variant="outline" onClick={() => void retry()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (isUpdating || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={`campanhas-analytics-kpi-skeleton-${index}`} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  const kpis = buildKpis(summary)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <Card key={kpi.key} className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground">{kpi.label}</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <span className="text-2xl font-semibold tabular-nums">{kpi.value}</span>
            <p className="text-xs text-muted-foreground">{kpi.base}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
