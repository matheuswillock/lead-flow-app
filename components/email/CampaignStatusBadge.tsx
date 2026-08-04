"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DEFAULT_TZ } from "@/lib/dates"
import { formatIntimezone } from "@/lib/dates"
import {
  AlertCircle,
  Archive,
  Ban,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  type LucideIcon,
} from "lucide-react"
import type { StudioEmailCampaignStatus } from "@/app/backoffice/(app)/clients/[masterId]/features/emails/services/IBackofficeStudioEmailService"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<
  StudioEmailCampaignStatus,
  { label: string; className: string; icon: LucideIcon }
> = {
  draft: {
    label: "Rascunho",
    className: "border bg-transparent text-muted-foreground",
    icon: FileText,
  },
  scheduled: {
    label: "Agendado",
    className: "border-semantic-info-border bg-semantic-info-surface text-semantic-info",
    icon: Clock,
  },
  sending: {
    label: "Enviando...",
    className: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
    icon: Loader2,
  },
  sent: {
    label: "Enviado",
    className: "border-semantic-success-border bg-semantic-success-surface text-semantic-success",
    icon: CheckCircle2,
  },
  canceled: {
    label: "Cancelado",
    className: "border bg-transparent text-muted-foreground/60",
    icon: Ban,
  },
  failed: {
    label: "Falhou",
    className: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
    icon: AlertCircle,
  },
  archived: {
    label: "Arquivado",
    className: "border bg-transparent text-muted-foreground/60",
    icon: Archive,
  },
}

type CampaignStatusBadgeProps = {
  status: string
  scheduledAt?: string | null
}

export function CampaignStatusBadge({ status, scheduledAt }: CampaignStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status as StudioEmailCampaignStatus] ?? STATUS_CONFIG.draft
  const Icon = cfg.icon
  const isAnimatedIcon = status === "sending"

  const scheduledLabel =
    status === "scheduled" && scheduledAt
      ? formatIntimezone(new Date(scheduledAt), "dd/MM/yyyy 'às' HH:mm", DEFAULT_TZ)
      : null

  const iconNode = (
    <Icon className={cn(isAnimatedIcon && "animate-spin")} data-icon="inline-start" />
  )

  return (
    <Badge className={cn("w-fit shrink-0 gap-1", cfg.className)}>
      {status === "scheduled" && scheduledLabel ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-default">{iconNode}</span>
          </TooltipTrigger>
          <TooltipContent>{scheduledLabel}</TooltipContent>
        </Tooltip>
      ) : (
        iconNode
      )}
      {cfg.label}
    </Badge>
  )
}
