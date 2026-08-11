"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  CRON_EXECUTION_STATUS_LABELS,
  getCronExecutionStatusBadgeClass,
  type CronExecutionStatusKey,
} from "../context/CronExecutionsContextTypes"

type BackofficeCronStatusBadgeProps = {
  status: CronExecutionStatusKey
}

export function BackofficeCronStatusBadge({ status }: BackofficeCronStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("font-medium", getCronExecutionStatusBadgeClass(status))}>
      {CRON_EXECUTION_STATUS_LABELS[status]}
    </Badge>
  )
}
