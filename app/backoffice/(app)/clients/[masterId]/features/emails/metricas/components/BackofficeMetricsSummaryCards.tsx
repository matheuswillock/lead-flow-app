"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { StudioEmailAnalytics } from "../../services/IBackofficeStudioEmailService"

function MetricCard({
  title,
  value,
  subtitle,
  highlight,
}: {
  title: string
  value: string
  subtitle?: string
  highlight?: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-3xl font-bold", highlight && "text-primary")}>{value}</p>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </CardContent>
    </Card>
  )
}

export function BackofficeMetricsSummaryCards({
  data,
  loading,
}: {
  data: StudioEmailAnalytics | null
  loading: boolean
}) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-9 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const { totals, rates } = data

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <MetricCard
        title="Enviados"
        value={totals.sent.toLocaleString("pt-BR")}
        subtitle="Total no período"
      />
      <MetricCard
        title="Entrega"
        value={`${rates.deliverabilityRate.toFixed(1)}%`}
        subtitle={`${totals.delivered.toLocaleString("pt-BR")} entregues`}
      />
      <MetricCard
        title="Abertura"
        value={`${rates.openRate.toFixed(1)}%`}
        subtitle={`${totals.opened.toLocaleString("pt-BR")} abertos`}
      />
      <MetricCard
        title="Cliques"
        value={`${rates.clickRate.toFixed(1)}%`}
        subtitle={`${totals.clicked.toLocaleString("pt-BR")} cliques`}
      />
      <MetricCard
        title="Bounce"
        value={`${rates.bounceRate.toFixed(1)}%`}
        subtitle={`${totals.bounced.toLocaleString("pt-BR")} bounces`}
        highlight={rates.bounceRate > 5}
      />
    </div>
  )
}
