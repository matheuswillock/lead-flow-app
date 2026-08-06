"use client"

import { Loader2 } from "lucide-react"
import { useCampaignDispatchRealtime } from "@/app/[supabaseId]/email/campanhas/features/context/CampaignDispatchRealtimeContext"
import { Separator } from "@/components/ui/separator"

export function CampaignDispatchIndicator() {
  const { sendingCampaigns } = useCampaignDispatchRealtime()

  if (sendingCampaigns.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 rounded-lg border border-border bg-card shadow-lg">
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
        {sendingCampaigns.map((campaign) => {
          const progress =
            campaign.totalRecipients > 0
              ? Math.min(Math.round((campaign.totalSent / campaign.totalRecipients) * 100), 100)
              : 0
          return (
            <div key={campaign.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">{campaign.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {campaign.totalSent}/{campaign.totalRecipients}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
