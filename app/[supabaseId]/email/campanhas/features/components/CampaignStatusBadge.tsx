import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import type { Campaign } from "../context/CampanhasTypes"

const STATUS_CONFIG: Record<Campaign["status"], { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "border bg-transparent text-muted-foreground" },
  scheduled: { label: "Agendado", className: "border-semantic-info-border bg-semantic-info-surface text-semantic-info" },
  sending: { label: "Enviando...", className: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning" },
  sent: { label: "Enviado", className: "border-semantic-success-border bg-semantic-success-surface text-semantic-success" },
  canceled: { label: "Cancelado", className: "border bg-transparent text-muted-foreground/60" },
  failed: { label: "Falhou", className: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger" },
}

export function CampaignStatusBadge({ status }: { status: Campaign["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <Badge className={cfg.className}>
      {status === "sending" ? (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" />
          {cfg.label}
        </span>
      ) : (
        cfg.label
      )}
    </Badge>
  )
}
