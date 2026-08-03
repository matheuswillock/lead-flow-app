"use client"

import { BarChart3 } from "lucide-react"
import { PeriodSelector } from "@/app/backoffice/(app)/emails/analytics/features/components/PeriodSelector"
import { DeliverabilityChart } from "@/app/backoffice/(app)/emails/analytics/features/components/DeliverabilityChart"
import { useBackofficeClientEmailsContext } from "../../context/BackofficeClientEmailsContext"
import { useBackofficeMetrics } from "../hooks/useBackofficeMetrics"
import { BackofficeMetricsSummaryCards } from "../components/BackofficeMetricsSummaryCards"
import type { AnalyticsPeriod } from "@/app/backoffice/(app)/emails/analytics/features/context/BackofficeEmailAnalyticsTypes"

export function BackofficeMetricsContainer() {
  const { masterId, selectedTeamId, refreshKey } = useBackofficeClientEmailsContext()
  const { data, loading, period, setPeriod } = useBackofficeMetrics(
    masterId,
    selectedTeamId,
    refreshKey
  )

  if (!selectedTeamId) return null

  const chartData = data
    ? {
        period: { from: data.period.from, to: data.period.to },
        totals: {
          sent: data.totals.sent,
          delivered: data.totals.delivered,
          opened: data.totals.opened,
          clicked: data.totals.clicked,
          bounced: data.totals.bounced,
          complained: 0,
        },
        rates: {
          deliverabilityRate: data.rates.deliverabilityRate,
          openRate: data.rates.openRate,
          clickRate: data.rates.clickRate,
          bounceRate: data.rates.bounceRate,
          complainRate: 0,
        },
        dispatches: [],
      }
    : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-6" />
          <h2 className="text-lg font-semibold">Métricas de e-mail</h2>
        </div>
        <PeriodSelector
          period={period as AnalyticsPeriod}
          onPeriodChange={(value) => setPeriod(value as typeof period)}
        />
      </div>

      <BackofficeMetricsSummaryCards data={data} loading={loading} />
      <DeliverabilityChart data={chartData} loading={loading} />
    </div>
  )
}
