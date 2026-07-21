import type { BackofficeBotChannelStatus } from "../context/BackofficeStudioBotTypes"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<BackofficeBotChannelStatus, string> = {
  pending: "Pendente",
  connected: "Conectado",
  disconnected: "Desconectado",
  error: "Erro",
}

function getVariant(
  status: BackofficeBotChannelStatus
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "connected") return "default"
  if (status === "pending" || status === "disconnected") return "secondary"
  return "destructive"
}

interface Props {
  status: BackofficeBotChannelStatus
  className?: string
}

export function BackofficeBotChannelStatusBadge({ status, className }: Props) {
  return (
    <Badge variant={getVariant(status)} className={cn(className)}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
