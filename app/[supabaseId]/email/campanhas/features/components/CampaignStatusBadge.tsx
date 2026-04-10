import { Badge } from "@/components/ui/badge"
import type { Campaign } from "../context/CampanhasTypes"

const STATUS_CONFIG: Record<Campaign["status"], { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "border bg-transparent text-muted-foreground" },
  scheduled: { label: "Agendado", className: "bg-blue-500/15 text-blue-700 border-0" },
  sending: { label: "Enviando...", className: "bg-amber-500/15 text-amber-700 border-0" },
  sent: { label: "Enviado", className: "bg-emerald-500/15 text-emerald-700 border-0" },
  canceled: { label: "Cancelado", className: "border bg-transparent text-muted-foreground/60" },
  failed: { label: "Falhou", className: "bg-destructive/15 text-destructive border-0" },
}

export function CampaignStatusBadge({ status }: { status: Campaign["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return <Badge className={cfg.className}>{cfg.label}</Badge>
}
