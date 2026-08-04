"use client"

import { AlertCircle, CheckCircle2, CircleAlert } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { WizardTabId } from "../validation/campaignWizardSchema"

export type WizardTabState = "valid" | "incomplete" | "error"

type CampaignWizardBrowserTabsProps = {
  activeTab: WizardTabId
  tabStates: Record<WizardTabId, WizardTabState>
  onTabChange: (tab: WizardTabId) => void
  disabled?: boolean
}

const TAB_LABELS: Record<WizardTabId, string> = {
  geral: "Geral",
  template: "Template",
  audiencia: "Audiência",
  agendamento: "Agendamento",
  subcampanhas: "Sub-campanhas",
}

function TabStatusIcon({ state }: { state: WizardTabState }) {
  if (state === "valid") {
    return <CheckCircle2 className="text-semantic-success" data-icon="inline-start" />
  }
  if (state === "error") {
    return <AlertCircle className="text-destructive" data-icon="inline-start" />
  }
  return <CircleAlert className="text-semantic-warning" data-icon="inline-start" />
}

export function CampaignWizardBrowserTabs({
  activeTab,
  tabStates,
  onTabChange,
  disabled = false,
}: CampaignWizardBrowserTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (disabled) return
        onTabChange(value as WizardTabId)
      }}
    >
      <TabsList
        className={cn(
          "h-auto w-full justify-start gap-0 rounded-none border-b bg-transparent p-0",
          disabled && "pointer-events-none opacity-40"
        )}
      >
        {(Object.keys(TAB_LABELS) as WizardTabId[]).map((tabId) => (
          <TabsTrigger
            key={tabId}
            value={tabId}
            disabled={disabled}
            className={cn(
              "rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 shadow-none",
              "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            )}
          >
            <TabStatusIcon state={tabStates[tabId]} />
            {TAB_LABELS[tabId]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
