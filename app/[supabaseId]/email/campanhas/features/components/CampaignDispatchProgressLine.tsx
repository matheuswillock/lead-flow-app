"use client"

import { cn } from "@/lib/utils"
import {
  formatCampaignDispatchProgressLabel,
  type CampaignDispatchProgress,
  type CampaignDispatchProgressSummary,
} from "@/lib/email/campaign-dispatch-progress"

type ProgressLike =
  | Pick<
      CampaignDispatchProgress,
      | "status"
      | "completionKind"
      | "acceptedCount"
      | "failedCount"
      | "totalRecipients"
      | "retryFailedOnly"
      | "errorMessage"
    >
  | null
  | undefined

function summaryToProgressLike(
  summary: CampaignDispatchProgressSummary | null | undefined
): ProgressLike {
  if (!summary) return null
  return {
    status: summary.completionKind === "pending" ? "sending" : "completed",
    completionKind: summary.completionKind,
    acceptedCount: summary.acceptedCount,
    failedCount: summary.failedCount,
    totalRecipients: summary.totalRecipients,
    retryFailedOnly: false,
    errorMessage: null,
  }
}

export function resolveCampaignDispatchProgressDisplay(
  campaign: {
    activeDispatch?: CampaignDispatchProgress | null
    latestDispatch?: CampaignDispatchProgress | null
    dispatchProgressSummary?: CampaignDispatchProgressSummary | null
    isParentCampaign?: boolean
    subCampaignCount?: number
  }
): ProgressLike {
  const isParent = Boolean(campaign.isParentCampaign || (campaign.subCampaignCount ?? 0) > 0)
  if (isParent) {
    return summaryToProgressLike(campaign.dispatchProgressSummary)
  }
  return campaign.activeDispatch ?? campaign.latestDispatch ?? null
}

export function CampaignDispatchProgressLine({
  progress,
  className,
  showBar = true,
}: {
  progress: ProgressLike
  className?: string
  showBar?: boolean
}) {
  const label = formatCampaignDispatchProgressLabel(progress)
  if (!progress || !label) return null

  const pct =
    progress.totalRecipients > 0
      ? Math.min(100, Math.round((progress.acceptedCount / progress.totalRecipients) * 100))
      : 0

  const toneClass =
    progress.completionKind === "failed"
      ? "text-destructive"
      : progress.completionKind === "partial"
        ? "text-semantic-warning"
        : "text-muted-foreground"

  return (
    <div
      className={cn("flex w-full max-w-[220px] flex-col gap-1", className)}
      aria-live="polite"
      data-testid="campaign-dispatch-progress-line"
    >
      <span className={cn("truncate text-xs tabular-nums", toneClass)}>{label}</span>
      {showBar && progress.status === "sending" ? (
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}
