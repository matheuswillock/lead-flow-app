import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { AnalyticsData } from "./AnalyticsTypes"

type MetricCardProps = {
  title: string
  value: string
  subtitle: string
  highlight?: boolean
}

function MetricCard({ title, value, subtitle, highlight }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-3xl font-bold", highlight && "text-primary")}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

type MetricsSummaryCardsProps = {
  data: AnalyticsData | null
  loading: boolean
}

export function MetricsSummaryCards({ data, loading }: MetricsSummaryCardsProps) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="mt-1 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const { totals, rates } = data

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        title="Entregabilidade"
        value={`${rates.deliverabilityRate.toFixed(1)}%`}
        subtitle={`${totals.delivered.toLocaleString("pt-BR")} entregues de ${totals.sent.toLocaleString("pt-BR")}`}
      />
      <MetricCard
        title="Taxa de Abertura"
        value={`${rates.openRate.toFixed(1)}%`}
        subtitle={`${totals.opened.toLocaleString("pt-BR")} abertos`}
      />
      <MetricCard
        title="Taxa de Cliques"
        value={`${rates.clickRate.toFixed(1)}%`}
        subtitle={`${totals.clicked.toLocaleString("pt-BR")} cliques`}
      />
      <MetricCard
        title="Taxa de Bounce"
        value={`${rates.bounceRate.toFixed(1)}%`}
        subtitle={`${totals.bounced.toLocaleString("pt-BR")} bounces`}
        highlight={rates.bounceRate > 5}
      />
    </div>
  )
}
