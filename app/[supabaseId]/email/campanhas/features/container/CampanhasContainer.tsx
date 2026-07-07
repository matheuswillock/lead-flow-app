"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { BarChart3, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCampanhasContext } from "../context/CampanhasContext"
import { CampaignDispatchProgressBanner } from "../components/CampaignDispatchProgressBanner"
import { CreditBalanceBar } from "../components/CreditBalanceBar"
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
  const { statusFilter, handleStatusFilter, openWizard } = useCampanhasContext()
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
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

      <CreditBalanceBar />
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
