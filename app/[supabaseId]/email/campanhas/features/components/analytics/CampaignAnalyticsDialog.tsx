"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { BarChart3, Radar, RefreshCw, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { buildCampaignRadarSegmentSlug } from "@/lib/radar/segment-audience"
import { CampaignLogsTab } from "../CampaignLogsTab"
import {
  CampaignDispatchProgressLine,
  resolveCampaignDispatchProgressDisplay,
} from "../CampaignDispatchProgressLine"
import { CampaignComparePanel } from "./CampaignComparePanel"
import { DeliverabilityChart } from "./DeliverabilityChart"
import { DispatchAccordionTable } from "./DispatchAccordionTable"
import { MetricsSummaryCards } from "./MetricsSummaryCards"
import { PeriodSelector } from "./PeriodSelector"
import { TrackingDegradedAlert } from "./TrackingDegradedAlert"
import { useCampaignAnalytics } from "./useCampaignAnalytics"
import { useOptionalStudioEmailHost } from "@/lib/email/studio-email-host"
import type { CampaignDispatchProgress, CampaignDispatchProgressSummary } from "../../context/CampanhasTypes"

type CampaignAnalyticsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId?: string
  campaignName?: string
  campaignErrorMessage?: string | null
  defaultTab?: "metrics" | "logs"
  activeDispatch?: CampaignDispatchProgress | null
  latestDispatch?: CampaignDispatchProgress | null
  dispatchProgressSummary?: CampaignDispatchProgressSummary | null
  isParentCampaign?: boolean
}

export function CampaignAnalyticsDialog({
  open,
  onOpenChange,
  campaignId,
  campaignName,
  campaignErrorMessage,
  defaultTab,
  activeDispatch,
  latestDispatch,
  dispatchProgressSummary,
  isParentCampaign,
}: CampaignAnalyticsDialogProps) {
  const host = useOptionalStudioEmailHost()
  const params = useParams<{ supabaseId?: string }>()
  const supabaseId = params.supabaseId
  const [activeTab, setActiveTab] = useState<"metrics" | "logs">("metrics")
  const { data, initialLoading, refreshing, period, handlePeriodChange, handleRefresh } =
    useCampaignAnalytics(campaignId, open)

  useEffect(() => {
    if (open) setActiveTab(defaultTab ?? "metrics")
  }, [campaignId, open, defaultTab])

  const progress = resolveCampaignDispatchProgressDisplay({
    activeDispatch,
    latestDispatch,
    dispatchProgressSummary,
    isParentCampaign,
  })

  const dispatchProgressKey = useMemo(() => {
    if (!campaignId || !progress) return undefined
    const dispatchId =
      activeDispatch?.dispatchId ??
      latestDispatch?.dispatchId ??
      `summary:${dispatchProgressSummary?.updatedAt ?? ""}`
    return `${campaignId}:${dispatchId}:${progress.status}:${progress.completionKind}:${progress.acceptedCount}:${progress.failedCount}:${activeDispatch?.updatedAt ?? latestDispatch?.updatedAt ?? dispatchProgressSummary?.updatedAt ?? ""}`
  }, [
    activeDispatch,
    campaignId,
    dispatchProgressSummary,
    latestDispatch,
    progress,
  ])

  const title = campaignName
    ? `Métricas — ${campaignName}`
    : "Métricas de E-mail"

  const radarHref =
    supabaseId && campaignId && !host
      ? `/${supabaseId}/radar?tab=segmentos&segment=${encodeURIComponent(buildCampaignRadarSegmentSlug(campaignId))}`
      : null

  const metricsContent = (
    <>
      {campaignErrorMessage ? (
        <Alert variant="destructive">
          <AlertTriangle data-icon="inline-start" />
          <AlertTitle>Campanha com falha</AlertTitle>
          <AlertDescription>{campaignErrorMessage}</AlertDescription>
        </Alert>
      ) : null}
      <TrackingDegradedAlert
        warnings={data?.trackingWarnings}
        blocked={data?.trackingDispatchBlocked}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <PeriodSelector period={period} onPeriodChange={handlePeriodChange} />
          <p className="text-xs text-muted-foreground">
            Entrega e engajamento atualizam automaticamente a cada 30s via eventos do Resend.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {radarHref ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={radarHref}>
                <Radar data-icon="inline-start" />
                Ver no Radar
              </Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw data-icon="inline-start" className={cn(refreshing && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>
      <MetricsSummaryCards data={data} loading={initialLoading} />
      <DeliverabilityChart data={data} loading={initialLoading} />
      {campaignId ? (
        <DispatchAccordionTable
          campaignId={campaignId}
          data={data}
          loading={initialLoading}
        />
      ) : null}
      <Separator />
      <CampaignComparePanel period={period} preselectedCampaignId={campaignId} />
    </>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-5" />
              <DialogTitle>{title}</DialogTitle>
            </div>
            <CampaignDispatchProgressLine progress={progress} className="max-w-md" />
          </div>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          {campaignId && !host ? (
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "metrics" | "logs")}
              className="flex min-h-0 flex-1 flex-col gap-4"
            >
              <TabsList className="w-fit justify-start">
                <TabsTrigger value="metrics">Métricas</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>
              <TabsContent value="metrics" className="mt-0 flex flex-col gap-4">
                {metricsContent}
              </TabsContent>
              <TabsContent value="logs" className="mt-0 min-h-0 flex-1" forceMount>
                <div className={cn(activeTab !== "logs" && "hidden")}>
                  {open ? (
                    <CampaignLogsTab
                      campaignId={campaignId}
                      dispatchProgressKey={dispatchProgressKey}
                    />
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            metricsContent
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
