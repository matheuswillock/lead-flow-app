"use client"

import { BarChart3 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PeriodSelector } from "../components/PeriodSelector"
import { MetricsSummaryCards } from "../components/MetricsSummaryCards"
import { DeliverabilityChart } from "../components/DeliverabilityChart"
import { CampaignComparisonTable } from "../components/CampaignComparisonTable"
import { useAnalyticsContext } from "../context/AnalyticsContext"

export function AnalyticsContainer() {
  const { campaigns, campaignId, handleCampaignFilter } = useAnalyticsContext()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">Analytics de E-mail</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PeriodSelector />
        <Select
          value={campaignId || "__all"}
          onValueChange={(v) => handleCampaignFilter(v === "__all" ? "" : v)}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todas as campanhas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas as campanhas</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <MetricsSummaryCards />
      <DeliverabilityChart />
      <CampaignComparisonTable />
    </div>
  )
}
