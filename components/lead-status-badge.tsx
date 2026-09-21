import type { CSSProperties } from "react"
import type { LeadStatus } from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getLeadStatusLabel, getLeadStatusStageColor } from "@/lib/lead-status"

interface LeadStatusBadgeProps {
  status: LeadStatus | string
  label?: string
  className?: string
}

export function LeadStatusBadge({ status, label, className }: LeadStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("lead-status-badge whitespace-nowrap rounded-full px-3 py-1 font-bold", className)}
      style={{ "--stage-color": getLeadStatusStageColor(status) } as CSSProperties}
    >
      {label ?? getLeadStatusLabel(status)}
    </Badge>
  )
}
