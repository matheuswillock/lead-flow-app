"use client"

import { Loader2 } from "lucide-react"
import { CAMPAIGN_DISPATCH_COUNTDOWN_DISPATCHED_LABEL } from "@/lib/email/campaign-dispatch-countdown"
import { cn } from "@/lib/utils"

export function CampaignDispatchCountdownButtonLabel({
  locked,
  countdownLabel,
  idleLabel,
  showLoader,
}: {
  locked: boolean
  countdownLabel: string | null
  idleLabel: string
  showLoader?: boolean
}) {
  const spinning =
    showLoader ??
    (locked && countdownLabel !== CAMPAIGN_DISPATCH_COUNTDOWN_DISPATCHED_LABEL)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 tabular-nums",
        locked && "min-w-64 justify-center"
      )}
      aria-live={locked ? "polite" : "off"}
      aria-atomic="true"
    >
      {spinning ? (
        <Loader2
          data-icon="inline-start"
          aria-hidden="true"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : null}
      {countdownLabel ?? idleLabel}
    </span>
  )
}
