"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { useDashboardContext } from "../context/DashboardContext"

export const description = "Gráfico de Leads e Conversões por Período"

const chartConfig = {
  conversoes: {
    label: "Conversões",
    color: "var(--chart-2)",
  },
  leads: {
    label: "Leads",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const { metrics, filters, customDateRange } = useDashboardContext()

  // Formatar dados para o gráfico
  const chartData = React.useMemo(() => {
    if (!metrics?.leadsPorPeriodo) return []
    
    return metrics.leadsPorPeriodo.map((item: { periodo: string; leads: number; conversoes: number }) => ({
      date: item.periodo,
      leads: item.leads,
      conversoes: item.conversoes,
    }))
  }, [metrics?.leadsPorPeriodo])

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case '7d':
        return 'Últimos 7 dias'
      case '30d':
        return 'Últimos 30 dias'
      case '3m':
        return 'Últimos 3 meses'
      default:
        return 'Últimos 30 dias'
    }
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Leads por Período</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {customDateRange ? "Período customizado" : getTimeRangeLabel(filters.period || "30d")}
          </span>
          <span className="@[540px]/card:hidden">
            {customDateRange ? "Customizado" : filters.period === '7d' ? '7 dias' : filters.period === '30d' ? '30 dias' : filters.period === '3m' ? '3 meses' : filters.period === '6m' ? '6 meses' : '1 ano'}
          </span>
        </CardDescription>
        <CardAction />
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-62.5 w-full"
        >
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillLeads" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-leads)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-leads)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillConversoes" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-conversoes)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-conversoes)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                try {
                  if (/^\d{4}-\d{2}$/.test(value)) {
                    return format(parseISO(`${value}-01`), "MMM/yy", { locale: ptBR })
                  }
                  return format(parseISO(value), "dd/MMM", { locale: ptBR })
                } catch {
                  return value
                }
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    try {
                      const v = String(value)
                      if (/^\d{4}-\d{2}$/.test(v)) {
                        return format(parseISO(`${v}-01`), "MMMM 'de' yyyy", { locale: ptBR })
                      }
                      return format(parseISO(v), "dd 'de' MMMM", { locale: ptBR })
                    } catch {
                      return String(value)
                    }
                  }}
                  indicator="dot"
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="conversoes"
              type="natural"
              fill="url(#fillConversoes)"
              stroke="var(--color-conversoes)"
              stackId="a"
            />
            <Area
              dataKey="leads"
              type="natural"
              fill="url(#fillLeads)"
              stroke="var(--color-leads)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
