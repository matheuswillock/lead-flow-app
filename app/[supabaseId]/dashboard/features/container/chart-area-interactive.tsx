"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

import { useIsMobile } from '@/hooks/use-mobile'
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
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { useDashboardContext } from "../context/DashboardContext"

export const description = "Gráfico de Leads e Conversões por Período"

const chartConfig = {
  leads: {
    label: "Leads",
    color: "var(--primary)", // Laranja vibrante
  },
  conversoes: {
    label: "Conversões",
    color: "var(--secondary)", // Laranja mais escuro
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const { metrics, filters, setPeriod } = useDashboardContext()
  const [timeRange, setTimeRange] = React.useState<'7d' | '30d' | '3m' | '6m' | '1y'>(
    filters.period || "30d"
  )

  React.useEffect(() => {
    if (isMobile && timeRange !== "7d") {
      setTimeRange("7d")
      setPeriod("7d")
    }
  }, [isMobile, timeRange, setPeriod])

  const handleTimeRangeChange = (value: string) => {
    const validPeriod = value as '7d' | '30d' | '3m' | '6m' | '1y'
    setTimeRange(validPeriod)
    setPeriod(validPeriod)
  }

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
            {getTimeRangeLabel(timeRange)}
          </span>
          <span className="@[540px]/card:hidden">
            {timeRange === '7d' ? '7 dias' : timeRange === '30d' ? '30 dias' : '3 meses'}
          </span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={handleTimeRangeChange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="3m">Últimos 3 meses</ToggleGroupItem>
            <ToggleGroupItem value="30d">Últimos 30 dias</ToggleGroupItem>
            <ToggleGroupItem value="7d">Últimos 7 dias</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              aria-label="Selecione um período"
            >
              <SelectValue placeholder="Últimos 30 dias" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="7d" className="rounded-lg">
                Últimos 7 dias
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Últimos 30 dias
              </SelectItem>
              <SelectItem value="3m" className="rounded-lg">
                Últimos 3 meses
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
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
                  const date = parseISO(value)
                  return format(date, "dd/MMM", { locale: ptBR })
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
                      const date = parseISO(String(value))
                      return format(date, "dd 'de' MMMM", { locale: ptBR })
                    } catch {
                      return String(value)
                    }
                  }}
                  indicator="dot"
                />
              }
            />
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
