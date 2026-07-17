import { Badge } from "@/components/ui/badge"
import type { BackofficeEmailCampaignStatus } from "../context/BackofficeEmailCampaignsTypes"

const STATUS_LABEL: Record<BackofficeEmailCampaignStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sending: "Enviando",
  sent: "Enviada",
  canceled: "Cancelada",
  failed: "Falhou",
}

const STATUS_VARIANT: Record<
  BackofficeEmailCampaignStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  sent: "default",
  canceled: "destructive",
  failed: "destructive",
}

export function EmailCampaignStatusBadge({ status }: { status: BackofficeEmailCampaignStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
}
