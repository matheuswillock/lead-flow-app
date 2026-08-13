import type { RadarSegmentCondition } from "@/lib/radar/segment-dsl"

/**
 * Condições padrão ao gerar segmento a partir de uma campanha enviada:
 * engajou no form (started) sem completar.
 * Open/click ficam fora do AND obrigatório — use additionalRules se precisar.
 */
export function extractCampaignEventConditions(
  campaignId: string,
  sentAt: Date | null,
): RadarSegmentCondition[] {
  if (!sentAt) return []

  const daysSinceSent = Math.ceil((Date.now() - sentAt.getTime()) / (1000 * 60 * 60 * 24))
  const windowDays = Math.max(30, daysSinceSent + 7)

  return [
    {
      kind: "event",
      eventType: "form.started",
      occurrence: "occurred",
      windowDays,
      campaignId,
    },
    {
      kind: "event",
      eventType: "form.completed",
      occurrence: "not_occurred",
      windowDays,
      campaignId,
    },
  ]
}
