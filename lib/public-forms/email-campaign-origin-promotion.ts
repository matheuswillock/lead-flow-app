import type { LeadOriginChannel, Prisma } from "@prisma/client"

export type EmailCampaignOriginPromotionInput = {
  currentChannel: LeadOriginChannel | null
  currentMetadata: Prisma.JsonValue | null | undefined
  campaignId: string | null
  emailLogId: string | null
}

export type EmailCampaignOriginPromotion = {
  originChannel: Extract<LeadOriginChannel, "email_campaign">
  originMetadata: Prisma.InputJsonValue
}

/**
 * Promove um lead para `originChannel = "email_campaign"` quando uma resposta
 * atribuída por `cs_el`/`EmailLog` anexa nele — sem isso o filtro "Origem =
 * Campanha de e-mail" do CRM mente (caso Bruno, `bugs/2026-08-28-liber-leads-
 * duplicados-origem-campanha-email.md`, requisitos 4/5/8).
 *
 * Faz MERGE dos metadados anteriores — nunca sobrescrita cega. Devolve `null`
 * quando o lead já está promovido com os MESMOS ids (idempotente: anexo
 * repetido não regride nem duplica nada).
 */
export function buildEmailCampaignOriginPromotion(
  input: EmailCampaignOriginPromotionInput,
): EmailCampaignOriginPromotion | null {
  const currentMetadata: Record<string, unknown> =
    input.currentMetadata &&
    typeof input.currentMetadata === "object" &&
    !Array.isArray(input.currentMetadata)
      ? { ...(input.currentMetadata as Record<string, unknown>) }
      : {}

  const alreadyPromoted =
    input.currentChannel === "email_campaign" &&
    currentMetadata.attribution === "email_campaign" &&
    (!input.emailLogId || currentMetadata.emailLogId === input.emailLogId) &&
    (!input.campaignId || currentMetadata.campaignId === input.campaignId)
  if (alreadyPromoted) return null

  return {
    originChannel: "email_campaign",
    originMetadata: {
      ...currentMetadata,
      attribution: "email_campaign",
      ...(input.emailLogId ? { emailLogId: input.emailLogId } : {}),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
    } as Prisma.InputJsonValue,
  }
}
