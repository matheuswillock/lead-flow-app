"use client"

import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCampanhasContext } from "../context/CampanhasContext"
import { CreditBalanceBar } from "../components/CreditBalanceBar"
import { CampaignList } from "../components/CampaignList"
import { CampaignCreateWizard } from "../components/CampaignCreateWizard"

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Campanhas</h1>
        </div>
        <Button size="sm" onClick={() => void openWizard()}>
          + Nova Campanha
        </Button>
      </div>

      <CreditBalanceBar />

      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusFilter(tab.value)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <CampaignList />
      <CampaignCreateWizard />
    </div>
  )
}
