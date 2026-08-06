"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { BarChart3, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LeadsDateFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsDateFilter"
import { LeadsFiltersLayout } from "@/app/[supabaseId]/components/leads-filters/LeadsFiltersLayout"
import { LeadsMultiFilter } from "@/app/[supabaseId]/components/leads-filters/LeadsMultiFilter"
import { useCampanhasContext } from "../context/CampanhasContext"
import type { DateRange } from "react-day-picker"
import { format } from "date-fns"
import { CampaignList } from "../components/CampaignList"
import { CampaignWizardDialog } from "../components/CampaignWizardDialog"
import type { ComponentType } from "react"
import { CampaignDetailSheet } from "../components/CampaignDetailSheet"
import { CampaignsOverviewPanel } from "../components/analytics/CampaignsOverviewPanel"
import { useStudioEmailRuntime } from "@/lib/email/use-studio-email-runtime"

type AnalyticsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId?: string
  campaignName?: string
  campaignErrorMessage?: string | null
  defaultTab?: "metrics" | "logs"
}

const DefaultCampaignAnalyticsDialog = dynamic(
  () =>
    import("../components/analytics/CampaignAnalyticsDialog").then(
      (mod) => mod.CampaignAnalyticsDialog
    ),
  { ssr: false }
) as ComponentType<AnalyticsDialogProps>

const STATUS_FILTER_OPTIONS = [
  { value: "draft", label: "Rascunhos" },
  { value: "scheduled", label: "Agendadas" },
  { value: "sending", label: "Enviando" },
  { value: "sent", label: "Enviadas" },
  { value: "partially_sent", label: "Parcialmente enviadas" },
  { value: "canceled", label: "Canceladas" },
  { value: "failed", label: "Falhou" },
  { value: "archived", label: "Arquivadas" },
]

export function CampanhasContainer({
  AnalyticsDialogComponent = DefaultCampaignAnalyticsDialog,
}: {
  AnalyticsDialogComponent?: ComponentType<AnalyticsDialogProps>
}) {
  const { readOnly } = useStudioEmailRuntime()
  const {
    statusFilter,
    nameFilter,
    dateFrom,
    dateTo,
    handleStatusFilter,
    handleNameFilter,
    handleDateFilter,
    clearFilters,
    openWizard,
  } = useCampanhasContext()
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [analyticsDefaultTab, setAnalyticsDefaultTab] = useState<"metrics" | "logs">("metrics")

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

  const hasActiveFilters = nameFilter || dateFrom || dateTo || statusFilter.length > 0
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
    defaultTab?: "metrics" | "logs"
  }, defaultTab?: "metrics" | "logs") {
    setAnalyticsCampaign(campaign)
    setAnalyticsDefaultTab(campaign.defaultTab ?? defaultTab ?? "metrics")
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
          <Button size="sm" onClick={() => void openWizard()} disabled={readOnly}>
            + Nova Campanha
          </Button>
        </div>
      </div>

      <CampaignsOverviewPanel />

      <LeadsFiltersLayout>
        <Input
          className="h-8 w-64 text-sm"
          placeholder="Filtrar por nome..."
          value={nameFilter}
          onChange={(e) => handleNameFilter(e.target.value)}
        />
        <LeadsMultiFilter
          title="Status"
          options={STATUS_FILTER_OPTIONS}
          selectedValues={statusFilter}
          onChange={handleStatusFilter}
        />
        <LeadsDateFilter
          title="Data de criação"
          value={dateRange}
          onChange={handleDateRangeChange}
        />
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" />
            Limpar filtros
          </Button>
        ) : null}
      </LeadsFiltersLayout>

      <CampaignList onOpenAnalytics={openCampaignAnalytics} />
      <CampaignWizardDialog />
      <CampaignDetailSheet onOpenAnalytics={openCampaignAnalytics} />
      <AnalyticsDialogComponent
        open={analyticsOpen}
        onOpenChange={setAnalyticsOpen}
        campaignId={analyticsCampaign?.id}
        campaignName={analyticsCampaign?.name}
        campaignErrorMessage={analyticsCampaign?.errorMessage}
        defaultTab={analyticsDefaultTab}
      />
    </div>
  )
}
