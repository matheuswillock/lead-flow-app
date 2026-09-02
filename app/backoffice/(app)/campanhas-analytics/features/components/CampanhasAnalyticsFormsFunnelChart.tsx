"use client"

import { AlertCircle } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
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

const FORMS_FUNNEL_CHART_TOP_N = 8

export const formsFunnelChartConfig = {
  viewed: { label: "Visualizações", color: "var(--chart-1)" },
  started: { label: "Inícios", color: "var(--chart-2)" },
  completed: { label: "Conclusões", color: "var(--chart-3)" },
} satisfies ChartConfig

export function CampanhasAnalyticsFormsFunnelChart() {
  const { formsFunnel, formsFunnelError, isUpdating, retry } = useCampanhasAnalytics()
  const prefersReducedMotion = useReducedMotionPreference()

  if (formsFunnelError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Funil de formulários</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            role="alert"
            className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="size-4" />
              {formsFunnelError}
            </span>
            <Button size="sm" variant="outline" onClick={() => void retry()}>
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isUpdating || !formsFunnel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Funil de formulários</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-62.5 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (formsFunnel.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Funil de formulários</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma visualização de formulário no período selecionado.
          </p>
        </CardContent>
      </Card>
    )
  }

  const topForms = [...formsFunnel].sort((a, b) => b.viewed - a.viewed).slice(0, FORMS_FUNNEL_CHART_TOP_N)
  const chartData = topForms.map((form) => ({
    formName: form.formName,
    viewed: form.viewed,
    started: form.started,
    completed: form.completed,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de formulários</CardTitle>
        <CardDescription>
          Top {FORMS_FUNNEL_CHART_TOP_N} formulários por visualizações — a tabela de
          formulários (abaixo) lista todos, com taxas de início e fechamento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={formsFunnelChartConfig}
          className="aspect-auto w-full"
          style={{ height: Math.max(chartData.length * 56, 160) }}
          role="img"
          aria-label="Gráfico de barras do funil de formulários: visualizações, inícios e conclusões por formulário"
        >
          <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="formName"
              tickLine={false}
              axisLine={false}
              width={160}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="viewed" fill="var(--color-viewed)" radius={4} isAnimationActive={!prefersReducedMotion} />
            <Bar dataKey="started" fill="var(--color-started)" radius={4} isAnimationActive={!prefersReducedMotion} />
            <Bar
              dataKey="completed"
              fill="var(--color-completed)"
              radius={4}
              isAnimationActive={!prefersReducedMotion}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
