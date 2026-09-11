"use client"

import { CampanhasAnalyticsDispatchesTable } from "../components/CampanhasAnalyticsDispatchesTable"
import { CampanhasAnalyticsFiltersBar } from "../components/CampanhasAnalyticsFiltersBar"
import { CampanhasAnalyticsFormsFunnelChart } from "../components/CampanhasAnalyticsFormsFunnelChart"
import { CampanhasAnalyticsFormsTable } from "../components/CampanhasAnalyticsFormsTable"
import { CampanhasAnalyticsKpiCards } from "../components/CampanhasAnalyticsKpiCards"
import { CampanhasAnalyticsOpenRateBarChart } from "../components/CampanhasAnalyticsOpenRateBarChart"
import { CampanhasAnalyticsSeriesAreaChart } from "../components/CampanhasAnalyticsSeriesAreaChart"
import { CampanhasAnalyticsTeamConversionBarChart } from "../components/CampanhasAnalyticsTeamConversionBarChart"
import { CampanhasAnalyticsTemplatesTable } from "../components/CampanhasAnalyticsTemplatesTable"

export function CampanhasAnalyticsContainer() {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Analytics de Campanhas</h1>
        <p className="text-sm text-muted-foreground">
          Disparos, entregas, aberturas e leads por período e time — a mesma análise que hoje
          exige uma sessão de agente, agora on-demand.
        </p>
      </div>

      <CampanhasAnalyticsFiltersBar />

      <CampanhasAnalyticsKpiCards />

      <CampanhasAnalyticsSeriesAreaChart />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CampanhasAnalyticsTeamConversionBarChart />
        <CampanhasAnalyticsOpenRateBarChart />
      </div>

      <CampanhasAnalyticsFormsFunnelChart />

      <CampanhasAnalyticsDispatchesTable />
      <CampanhasAnalyticsTemplatesTable />
      <CampanhasAnalyticsFormsTable />
    </div>
  )
}
