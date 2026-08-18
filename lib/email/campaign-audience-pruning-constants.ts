import type { EmailCampaignStatus } from "@prisma/client"

export const CAMPAIGN_AUDIENCE_PRUNABLE_STATUSES = [
  "draft",
  "scheduled",
  "partially_sent",
] as const satisfies readonly EmailCampaignStatus[]

export const CAMPAIGN_CANCELED_ALL_SUPPRESSED_MESSAGE =
  "Campanha cancelada: todos os destinatários restantes estão com bounce, descadastro ou reclamação."
