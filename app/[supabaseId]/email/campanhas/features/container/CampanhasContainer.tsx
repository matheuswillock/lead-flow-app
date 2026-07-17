"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { BarChart3, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter"
import { useCampanhasContext } from "../context/CampanhasContext"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { CampaignDispatchProgressBanner } from "../components/CampaignDispatchProgressBanner"
import { CampaignList } from "../components/CampaignList"
import { CampaignCreateWizard } from "../components/CampaignCreateWizard"
import { CampaignEditDialog } from "../components/CampaignEditDialog"

// Dialog de analytics usa recharts (bundle pesado); carrega sob demanda,
// somente quando o usuário abre as métricas de uma campanha.
const CampaignAnalyticsDialog = dynamic(
  () =>
    import("../components/analytics/CampaignAnalyticsDialog").then(
      (mod) => mod.CampaignAnalyticsDialog
    ),
  { ssr: false }
)

const STATUS_TABS = [
  { value: "", label: "Todas" },
  { value: "draft", label: "Rascunhos" },
  { value: "scheduled", label: "Agendadas" },
  { value: "sending", label: "Enviando" },
  { value: "sent", label: "Enviadas" },
  { value: "canceled", label: "Canceladas" },
  { value: "failed", label: "Falhou" },
]

export function CampanhasContainer() {
  const { statusFilter, nameFilter, dateFrom, dateTo, handleStatusFilter, handleNameFilter, handleDateFilter, clearFilters, openWizard } = useCampanhasContext()
  const [analyticsOpen, setAnalyticsOpen] = useState(false)

  const dateRange: DateRange | undefined =
    dateFrom || dateTo
      ? {
          from: dateFrom ? new Date(`${dateFrom}T00:00:00`) : undefined,
          to: dateTo ? new Date(`${dateTo}T00:00:00`) : undefined,
        }
      : undefined

  function handleDateRangeChange(range: DateRange | undefined) {
    handleDateFilter(
      range?.from ? format(range.from, "yyyy-MM-dd") : "",
      range?.to ? format(range.to, "yyyy-MM-dd") : "",
    )
  }

  const hasActiveFilters = nameFilter || dateFrom || dateTo
  const [analyticsCampaign, setAnalyticsCampaign] = useState<{
    id: string
    name: string
    errorMessage?: string | null
  } | null>(null)

  function openGeneralAnalytics() {
    setAnalyticsCampaign(null)
    setAnalyticsOpen(true)
  }

  function openCampaignAnalytics(campaign: {
    id: string
    name: string
    errorMessage?: string | null
  }) {
    setAnalyticsCampaign(campaign)
    setAnalyticsOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Campanhas</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={openGeneralAnalytics}>
            <BarChart3 data-icon="inline-start" />
            Métricas
          </Button>
          <Button size="sm" onClick={() => void openWizard()}>
            + Nova Campanha
          </Button>
        </div>
      </div>

      <CampaignDispatchProgressBanner />

      <Tabs
        value={statusFilter === "" ? "all" : statusFilter}
        onValueChange={(value) => handleStatusFilter(value === "all" ? "" : value)}
      >
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value || "all"} value={tab.value || "all"} className="shrink-0">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-8 w-64 text-sm"
          placeholder="Filtrar por nome..."
          value={nameFilter}
          onChange={(e) => handleNameFilter(e.target.value)}
        />
        <LeadsDateFilter
          title="Data de criação"
          value={dateRange}
          onChange={handleDateRangeChange}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" />
            Limpar filtros
          </Button>
        )}
      </div>

      <CampaignList onOpenAnalytics={openCampaignAnalytics} />
      <CampaignCreateWizard />
      <CampaignEditDialog />
      <CampaignAnalyticsDialog
        open={analyticsOpen}
        onOpenChange={setAnalyticsOpen}
        campaignId={analyticsCampaign?.id}
        campaignName={analyticsCampaign?.name}
        campaignErrorMessage={analyticsCampaign?.errorMessage}
      />
    </div>
  )
}
