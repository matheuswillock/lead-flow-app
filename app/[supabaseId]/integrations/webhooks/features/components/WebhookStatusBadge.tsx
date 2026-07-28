"use client";

import { Badge } from "@/components/ui/badge";
import type { TeamWebhookStatus } from "../services/ITeamWebhooksService";

const STATUS_CONFIG: Record<
  TeamWebhookStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  active: { label: "Ativo", variant: "default" },
  paused: { label: "Pausado", variant: "destructive" },
  disabled: { label: "Desativado", variant: "secondary" },
};

export function WebhookStatusBadge({ status }: { status: TeamWebhookStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
