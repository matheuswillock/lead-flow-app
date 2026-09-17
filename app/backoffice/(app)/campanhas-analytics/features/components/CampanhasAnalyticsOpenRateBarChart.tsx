"use client"

import { AlertCircle } from "lucide-react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampanhasAnalytics } from "../context/useCampanhasAnalyticsHook"
import { useReducedMotionPreference } from "../hooks/useReducedMotionPreference"
import { formatCampaignAnalyticsRate } from "../utils/campaignAnalyticsFormatters"

export const openRateChartConfig = {
  openRate: { label: "Abertura", color: "var(--chart-2)" },
} satisfies ChartConfig

export function CampanhasAnalyticsOpenRateBarChart() {
  const { summary, summaryError, isUpdating, retry } = useCampanhasAnalytics()
  const prefersReducedMotion = useReducedMotionPreference()

  if (summaryError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Abertura por time</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    )
  }

  if (isUpdating || !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Abertura por time</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-62.5 w-full" />
        </CardContent>
      </Card>
    )
  }

  // Times sem envio no período ficam ausentes (nunca barra zero sintética).
  const withData = summary.byTeam.filter((team) => team.sent > 0)

  if (withData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Abertura por time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sem disparos no período selecionado.
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartData = [...withData]
    .sort((a, b) => (b.openRate ?? -1) - (a.openRate ?? -1))
    .map((team) => ({ teamName: team.teamName, openRate: team.openRate ?? 0 }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Abertura por time</CardTitle>
        <CardDescription>Taxa de abertura (aberturas ÷ enviados) por time filtrado</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={openRateChartConfig}
          className="aspect-auto w-full"
          style={{ height: Math.max(chartData.length * 40, 120) }}
          role="img"
          aria-label="Gráfico de barras com a taxa de abertura por time"
        >
          <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 32 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="teamName"
              tickLine={false}
              axisLine={false}
              width={140}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value) => formatCampaignAnalyticsRate(Number(value))}
                />
              }
            />
            <Bar dataKey="openRate" fill="var(--color-openRate)" radius={4} isAnimationActive={!prefersReducedMotion}>
              <LabelList
                dataKey="openRate"
                position="right"
                className="fill-foreground"
                fontSize={12}
                formatter={(value) => formatCampaignAnalyticsRate(Number(value))}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
