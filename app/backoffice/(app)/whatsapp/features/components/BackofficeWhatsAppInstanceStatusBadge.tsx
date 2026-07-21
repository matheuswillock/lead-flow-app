import type { WhatsAppConnectionStatus } from "../context/BackofficeWhatsAppInstancesTypes"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<WhatsAppConnectionStatus, string> = {
  PENDING: "Pendente",
  QR_READY: "Aguardando QR",
  CONNECTED: "Conectado",
  DISCONNECTED: "Desconectado",
  ERROR: "Erro",
  BANNED: "Bloqueado",
}

function getVariant(
  status: WhatsAppConnectionStatus
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "CONNECTED") return "default"
  if (status === "QR_READY" || status === "DISCONNECTED" || status === "PENDING") return "secondary"
  return "destructive"
}

interface Props {
  status: WhatsAppConnectionStatus
  className?: string
}

export function BackofficeWhatsAppInstanceStatusBadge({ status, className }: Props) {
  return (
    <Badge variant={getVariant(status)} className={cn(className)}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
