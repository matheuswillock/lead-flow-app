"use client"

import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react"
import {
  useCampaignDispatchRealtime,
  type SendingCampaign,
  type TerminalCampaign,
} from "@/app/[supabaseId]/email/campanhas/features/context/CampaignDispatchRealtimeContext"
import { Separator } from "@/components/ui/separator"
import { formatCampaignDispatchProgressLabel } from "@/lib/email/campaign-dispatch-progress"
import { cn } from "@/lib/utils"

function progressLabel(campaign: SendingCampaign | TerminalCampaign): string {
  return (
    formatCampaignDispatchProgressLabel({
      status: campaign.status === "sending" || !campaign.status ? "sending" : campaign.status,
      completionKind: campaign.completionKind ?? "pending",
      acceptedCount: campaign.acceptedCount ?? campaign.totalSent,
      totalRecipients: campaign.totalRecipients,
      retryFailedOnly: campaign.retryFailedOnly ?? false,
      errorMessage: campaign.errorMessage ?? null,
    }) ?? `${campaign.acceptedCount ?? campaign.totalSent}/${campaign.totalRecipients}`
  )
}

function CampaignProgressRow({
  campaign,
  tone,
}: {
  campaign: SendingCampaign | TerminalCampaign
  tone: "active" | "success" | "warning" | "destructive"
}) {
  const accepted = campaign.acceptedCount ?? campaign.totalSent
  const progress =
    campaign.totalRecipients > 0
      ? Math.min(Math.round((accepted / campaign.totalRecipients) * 100), 100)
      : 0

  const barClass =
    tone === "destructive"
      ? "bg-destructive"
      : tone === "warning"
        ? "bg-semantic-warning"
        : tone === "success"
          ? "bg-primary"
          : "bg-primary"

  return (
    <div className="flex flex-col gap-1" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{campaign.name}</span>
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            tone === "destructive"
              ? "text-destructive"
              : tone === "warning"
                ? "text-semantic-warning"
                : "text-muted-foreground"
          )}
        >
          {progressLabel(campaign)}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barClass)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export function CampaignDispatchIndicator() {
  const { sendingCampaigns, terminalCampaigns } = useCampaignDispatchRealtime()

  if (sendingCampaigns.length === 0 && terminalCampaigns.length === 0) return null

  const visibleTerminals = terminalCampaigns.slice(0, 3)

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 rounded-lg border border-border bg-card shadow-lg">
      {sendingCampaigns.length > 0 ? (
        <>
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            <span className="text-sm font-medium leading-none">
              {sendingCampaigns.length === 1
                ? "Disparando campanha"
                : `Disparando ${sendingCampaigns.length} campanhas`}
            </span>
          </div>
          <p className="px-3 pb-2 text-xs text-muted-foreground">
            Pode navegar livremente — o envio continua em segundo plano.
          </p>
          <Separator />
          <div className="flex flex-col gap-2 p-3">
            {sendingCampaigns.map((campaign) => (
              <CampaignProgressRow key={campaign.id} campaign={campaign} tone="active" />
            ))}
          </div>
        </>
      ) : null}

      {visibleTerminals.length > 0 ? (
        <>
          {sendingCampaigns.length > 0 ? <Separator /> : null}
          <div className="flex flex-col gap-2 p-3">
            {visibleTerminals.map((campaign) => {
              const tone =
                campaign.completionKind === "failed"
                  ? "destructive"
                  : campaign.completionKind === "partial"
                    ? "warning"
                    : "success"
              const Icon =
                tone === "destructive"
                  ? TriangleAlert
                  : tone === "warning"
                    ? TriangleAlert
                    : CheckCircle2
              return (
                <div key={campaign.dispatchId} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        tone === "destructive"
                          ? "text-destructive"
                          : tone === "warning"
                            ? "text-semantic-warning"
                            : "text-primary"
                      )}
                    />
                    <span className="text-sm font-medium leading-none">
                      {tone === "destructive"
                        ? "Disparo falhou"
                        : tone === "warning"
                          ? "Disparo parcial"
                          : "Disparo concluído"}
                    </span>
                  </div>
                  <CampaignProgressRow campaign={campaign} tone={tone} />
                </div>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}
