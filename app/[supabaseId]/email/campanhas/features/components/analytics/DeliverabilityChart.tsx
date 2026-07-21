"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { AnalyticsData } from "./AnalyticsTypes"

type DeliverabilityChartProps = {
  data: AnalyticsData | null
  loading: boolean
}

export function DeliverabilityChart({ data, loading }: DeliverabilityChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.totals.sent === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visão Geral do Período</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">
            Nenhum dado disponível para o período selecionado
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartData = [
    { name: "Enviados", value: data.totals.sent },
    { name: "Entregues", value: data.totals.delivered },
    { name: "Abertos", value: data.totals.opened },
    { name: "Clicados", value: data.totals.clicked },
    { name: "Bounces", value: data.totals.bounced },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Visão Geral do Período</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => [Number(value ?? 0).toLocaleString("pt-BR"), "E-mails"]}
            />
            <Bar dataKey="value" className="fill-primary" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
