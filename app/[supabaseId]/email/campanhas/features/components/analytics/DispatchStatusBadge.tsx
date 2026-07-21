import { Badge } from "@/components/ui/badge"
import type { DispatchAnalyticsStatus } from "./AnalyticsTypes"

const STATUS_CONFIG: Record<
  DispatchAnalyticsStatus,
  { label: string; className: string }
> = {
  completed: {
    label: "Sucesso",
    className: "border-semantic-success-border bg-semantic-success-surface text-semantic-success",
  },
  failed: {
    label: "Falhou",
    className: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
  },
  sending: {
    label: "Enviando...",
    className: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
  },
}

export function DispatchStatusBadge({ status }: { status: DispatchAnalyticsStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.sending
  return <Badge className={cfg.className}>{cfg.label}</Badge>
}
