'use client'

import { Badge } from '@/components/ui/badge'
import type { DialerCampaignStatus } from '../context/DialerTypes'

const STATUS_CONFIG: Record<
  DialerCampaignStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  ready: { label: 'Pronta', variant: 'secondary' },
  running: { label: 'Discando', variant: 'default' },
  paused: { label: 'Pausada', variant: 'secondary' },
  completed: { label: 'Concluída', variant: 'secondary' },
  canceled: { label: 'Cancelada', variant: 'destructive' },
  limit_reached: { label: 'Limite atingido', variant: 'destructive' },
}

export function CampaignStatusBadge({ status }: { status: DialerCampaignStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return <Badge variant={config.variant}>{config.label}</Badge>
}
