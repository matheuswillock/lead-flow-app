"use client"

import { Trophy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { MetricTrendIndicator } from "./MetricTrendIndicator"
import { TrackingDegradedAlert } from "./TrackingDegradedAlert"
import { useCampaignsOverview } from "./useCampaignsOverview"

type OverviewMetricProps = {
  title: string
  value: string
  subtitle: string
  delta?: Parameters<typeof MetricTrendIndicator>[0]["delta"]
  isRate?: boolean
}

function OverviewMetric({ title, value, subtitle, delta, isRate }: OverviewMetricProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-2">
          <p className="text-3xl font-bold">{value}</p>
          <MetricTrendIndicator delta={delta} isRate={isRate} className="mb-1" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export function CampaignsOverviewPanel() {
  const { data, loading, error } = useCampaignsOverview(true)

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar o resumo do dia.
      </p>
    )
  }

  if (loading || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="mb-2 h-4 w-28" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="mt-1 h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const { totals, rates, deltas, topCampaigns } = data
  const emptyDay = totals.sent === 0

  return (
    <div className="flex flex-col gap-4">
      <TrackingDegradedAlert warnings={data.trackingWarnings} />
      <div className="grid gap-4 md:grid-cols-3">
        <OverviewMetric
          title="Entregabilidade (hoje)"
          value={`${rates.deliverabilityRate.toFixed(1)}%`}
          subtitle={
            emptyDay
              ? "Sem envios hoje"
              : `${totals.delivered.toLocaleString("pt-BR")} de ${totals.sent.toLocaleString("pt-BR")}`
          }
          delta={deltas?.rates.deliverabilityRate}
          isRate
        />
        <OverviewMetric
          title="Taxa de Abertura (hoje)"
          value={`${rates.openRate.toFixed(1)}%`}
          subtitle={`${totals.opened.toLocaleString("pt-BR")} abertos`}
          delta={deltas?.rates.openRate}
          isRate
        />
        <OverviewMetric
          title="Taxa de Cliques (hoje)"
          value={`${rates.clickRate.toFixed(1)}%`}
          subtitle={`${totals.clicked.toLocaleString("pt-BR")} cliques`}
          delta={deltas?.rates.clickRate}
          isRate
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Trophy className="size-4 text-primary" />
            Top 3 campanhas do dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há campanhas elegíveis no ranking de hoje (mínimo de 10 envios).
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {topCampaigns.map((campaign) => (
                <li
                  key={campaign.campaignId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">#{campaign.rank}</Badge>
                    <span className="text-sm font-medium">{campaign.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      Abertura{" "}
                      <strong className="text-foreground">
                        {campaign.rates.openRate.toFixed(1)}%
                      </strong>
                    </span>
                    <span>{campaign.sent.toLocaleString("pt-BR")} envios</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
