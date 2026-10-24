import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  HEALTH_LABELS,
  ROLLOUT_LABELS,
  type ProviderInstanceView,
} from "../context/BackofficePaymentProvidersTypes"

const HEALTH_TONE: Record<ProviderInstanceView["healthStatus"], string> = {
  HEALTHY: "border-semantic-success-border bg-semantic-success-surface text-semantic-success",
  UNHEALTHY: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
  UNKNOWN: "text-muted-foreground",
}

export function ProviderStatusBadges({ instance }: { instance: ProviderInstanceView }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {instance.isDefault && <Badge>Padrão</Badge>}
      {!instance.paymentCapable && <Badge variant="secondary">Somente credenciais</Badge>}
      {instance.killSwitch && <Badge variant="destructive">Kill switch ativo</Badge>}
      <Badge variant="outline" className={cn(HEALTH_TONE[instance.healthStatus])}>
        {HEALTH_LABELS[instance.healthStatus]}
      </Badge>
      <Badge variant="outline">{ROLLOUT_LABELS[instance.rolloutState]}</Badge>
    </div>
  )
}
