"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

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
import { useDashboard } from '@/hooks/useDashboard'
import { useUser } from '@/app/context/UserContext'
import { Loader2 } from 'lucide-react'

export const description = "An interactive area chart"

const chartConfig = {
  value: {
    label: "Leads",
    color: "var(--primary)",
  },
  mobile: {
    label: "Conversões",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const { user } = useUser();
  const { metrics, isLoading, error } = useDashboard(user?.supabaseId || null);
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  // Formatar dados do dashboard para o gráfico
  const chartData = React.useMemo(() => {
    if (!metrics?.monthlyTrend) return [];
    
    return metrics.monthlyTrend.map(trend => ({
      date: trend.month,
      value: trend.leads, // Usar leads como valor principal
      // Adicionar dados fictícios para mobile para manter compatibilidade
      mobile: Math.floor(trend.leads * 0.6), // 60% do valor principal
    }));
  }, [metrics]);

  const filteredData = chartData.filter((item) => {
    if (!item.date) return false;
    
    const date = new Date(item.date + "-01"); // Adiciona dia para formar data válida
    const referenceDate = new Date();
    let monthsToSubtract = 3;
    
    if (timeRange === "30d") {
      monthsToSubtract = 1;
    } else if (timeRange === "7d") {
      monthsToSubtract = 1;
    } else if (timeRange === "90d") {
      monthsToSubtract = 3;
    }
    
    const startDate = new Date(referenceDate);
    startDate.setMonth(startDate.getMonth() - monthsToSubtract);
    return date >= startDate;
  });

  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando dados...
          </CardTitle>
          <CardDescription>
            Aguarde enquanto carregamos os dados do dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <CardTitle className="text-red-600">Erro ao carregar gráfico</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Leads por Período</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Total de leads dos últimos 3 meses
          </span>
          <span className="@[540px]/card:hidden">Últimos 3 meses</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Últimos 3 meses</ToggleGroupItem>
            <ToggleGroupItem value="30d">Últimos 30 dias</ToggleGroupItem>
            <ToggleGroupItem value="7d">Últimos 7 dias</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              aria-label="Selecionar período"
            >
              <SelectValue placeholder="Últimos 3 meses" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Últimos 3 meses
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Últimos 30 dias
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Últimos 7 dias
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
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-value)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-value)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-mobile)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-mobile)"
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
                // Formatar como YYYY-MM para mês/ano
                if (value.includes('-')) {
                  const [year, month] = value.split('-');
                  const date = new Date(parseInt(year), parseInt(month) - 1);
                  return date.toLocaleDateString("pt-BR", {
                    month: "short",
                    year: "2-digit",
                  });
                }
                return value;
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    if (typeof value === 'string' && value.includes('-')) {
                      const [year, month] = value.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1);
                      return date.toLocaleDateString("pt-BR", {
                        month: "long",
                        year: "numeric",
                      });
                    }
                    return value;
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="mobile"
              type="natural"
              fill="url(#fillMobile)"
              stroke="var(--color-mobile)"
              stackId="a"
            />
            <Area
              dataKey="value"
              type="natural"
              fill="url(#fillValue)"
              stroke="var(--color-value)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
