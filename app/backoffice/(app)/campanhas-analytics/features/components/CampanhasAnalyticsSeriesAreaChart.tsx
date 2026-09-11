"use client"

import { AlertCircle } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampanhasAnalytics } from "../context/useCampanhasAnalyticsHook"
import { useReducedMotionPreference } from "../hooks/useReducedMotionPreference"
import { formatCampaignAnalyticsDay } from "../utils/campaignAnalyticsFormatters"

// Cores exclusivamente via tokens --chart-1..3 — T-11.4 falha se aparecer hex/cor crua aqui.
export const seriesChartConfig = {
  sent: { label: "Enviados", color: "var(--chart-1)" },
  delivered: { label: "Entregues", color: "var(--chart-2)" },
  opened: { label: "Abertos", color: "var(--chart-3)" },
} satisfies ChartConfig

export function CampanhasAnalyticsSeriesAreaChart() {
  const { series, seriesError, isUpdating, retry } = useCampanhasAnalytics()
  const prefersReducedMotion = useReducedMotionPreference()

  if (seriesError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enviados, entregues e abertos por dia</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            role="alert"
            className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="size-4" />
              {seriesError}
            </span>
            <Button size="sm" variant="outline" onClick={() => void retry()}>
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isUpdating || !series) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enviados, entregues e abertos por dia</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-62.5 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (series.total.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enviados, entregues e abertos por dia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sem disparos no período selecionado.
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartData = series.total.map((point) => ({
    day: point.day,
    sent: point.sent,
    delivered: point.delivered,
    opened: point.opened,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enviados, entregues e abertos por dia</CardTitle>
        <CardDescription>
          Série diária agregada de todos os times filtrados. Valores exatos por dia estão na
          tabela de disparos, abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={seriesChartConfig}
          className="aspect-auto h-62.5 w-full"
          role="img"
          aria-label="Gráfico de área mostrando e-mails enviados, entregues e abertos por dia"
        >
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="campanhas-fill-sent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sent)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-sent)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="campanhas-fill-delivered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-delivered)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-delivered)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="campanhas-fill-opened" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-opened)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-opened)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string) => formatCampaignAnalyticsDay(value)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent labelFormatter={(value) => formatCampaignAnalyticsDay(String(value))} indicator="dot" />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="sent"
              type="natural"
              fill="url(#campanhas-fill-sent)"
              stroke="var(--color-sent)"
              isAnimationActive={!prefersReducedMotion}
            />
            <Area
              dataKey="delivered"
              type="natural"
              fill="url(#campanhas-fill-delivered)"
              stroke="var(--color-delivered)"
              isAnimationActive={!prefersReducedMotion}
            />
            <Area
              dataKey="opened"
              type="natural"
              fill="url(#campanhas-fill-opened)"
              stroke="var(--color-opened)"
              isAnimationActive={!prefersReducedMotion}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
