import type { CSSProperties } from "react"
import type { LeadStatus } from "@prisma/client"

import { cn } from "@/lib/utils"
import { getLeadStatusLabel, getLeadStatusStageColor } from "@/lib/lead-status"

interface LeadStatusBadgeProps {
  status: LeadStatus | string
  label?: string
  className?: string
}

export function LeadStatusBadge({ status, label, className }: LeadStatusBadgeProps) {
  return (
    <span
      className={cn(
        "lead-status-badge inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold",
        className
      )}
      style={{ "--stage-color": getLeadStatusStageColor(status) } as CSSProperties}
    >
      {label ?? getLeadStatusLabel(status)}
    </span>
  )
}
