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
  lockedTabs?: WizardTabId[]
  disabled?: boolean
}

// Abas do wizard: Geral → Audiência → Sub-campanhas → Revisão
const TAB_LABELS: Record<WizardTabId, string> = {
  geral: "Geral",
  audiencia: "Audiência",
  subcampanhas: "Sub-campanhas",
  revisao: "Revisão",
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
  lockedTabs = [],
  disabled = false,
}: CampaignWizardBrowserTabsProps) {
  const lockedSet = new Set(lockedTabs)

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (disabled) return
        const nextTab = value as WizardTabId
        if (lockedSet.has(nextTab)) return
        onTabChange(nextTab)
      }}
    >
      <TabsList
        className={cn(
          "h-auto w-full justify-start gap-0 rounded-none border-b bg-transparent p-0",
          disabled && "pointer-events-none opacity-40"
        )}
      >
        {(Object.keys(TAB_LABELS) as WizardTabId[]).map((tabId) => {
          const isLocked = lockedSet.has(tabId)
          return (
            <TabsTrigger
              key={tabId}
              value={tabId}
              disabled={disabled || isLocked}
              aria-disabled={disabled || isLocked ? true : undefined}
              className={cn(
                "rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 shadow-none",
                "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                isLocked && "pointer-events-none cursor-not-allowed opacity-40"
              )}
            >
              <TabStatusIcon state={tabStates[tabId]} />
              {TAB_LABELS[tabId]}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
