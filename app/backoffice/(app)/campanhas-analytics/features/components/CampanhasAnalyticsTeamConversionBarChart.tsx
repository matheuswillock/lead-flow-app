"use client"

import { AlertCircle } from "lucide-react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampanhasAnalytics } from "../context/useCampanhasAnalyticsHook"
import { useReducedMotionPreference } from "../hooks/useReducedMotionPreference"
import { formatCampaignAnalyticsInteger } from "../utils/campaignAnalyticsFormatters"

export const teamConversionChartConfig = {
  leads: { label: "Leads (criados + anexados)", color: "var(--chart-1)" },
} satisfies ChartConfig

export function CampanhasAnalyticsTeamConversionBarChart() {
  const { summary, summaryError, isUpdating, retry } = useCampanhasAnalytics()
  const prefersReducedMotion = useReducedMotionPreference()

  if (summaryError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leads por time</CardTitle>
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
          <CardTitle>Leads por time</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-62.5 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (summary.byTeam.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leads por time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sem disparos no período selecionado.
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartData = [...summary.byTeam]
    .sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1))
    .map((team) => ({ teamName: team.teamName, leads: team.leads }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads por time</CardTitle>
        <CardDescription>
          Ranking por Nota Final (leads/1.000 enviados) — o backend ainda não separa leads
          criados de anexados por time (só nos KPIs e no funil de formulários).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={teamConversionChartConfig}
          className="aspect-auto w-full"
          style={{ height: Math.max(chartData.length * 40, 120) }}
          role="img"
          aria-label="Gráfico de barras com o total de leads por time, ordenado por Nota Final"
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
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Bar dataKey="leads" fill="var(--color-leads)" radius={4} isAnimationActive={!prefersReducedMotion}>
              <LabelList
                dataKey="leads"
                position="right"
                className="fill-foreground"
                fontSize={12}
                formatter={(value) => formatCampaignAnalyticsInteger(Number(value))}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
