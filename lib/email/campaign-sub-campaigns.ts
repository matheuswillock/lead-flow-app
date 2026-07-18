import { addDays } from "date-fns"
import {
  EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY,
  EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB,
} from "@/lib/email/campaign-limits"

export type SubCampaignRecipientChunk = {
  contactIds: string[]
  size: number
  index: number
}

/** Particiona IDs de contato em lotes de até EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB. */
export function chunkContactIdsForSubCampaigns(
  contactIds: string[],
  maxPerSub: number = EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB
): SubCampaignRecipientChunk[] {
  if (contactIds.length === 0 || maxPerSub < 1) return []

  const chunks: SubCampaignRecipientChunk[] = []
  for (let offset = 0; offset < contactIds.length; offset += maxPerSub) {
    const slice = contactIds.slice(offset, offset + maxPerSub)
    chunks.push({
      contactIds: slice,
      size: slice.length,
      index: chunks.length + 1,
    })
  }
  return chunks
}

/** Gera scheduledAt de cada sub-campanha: start + (i * intervalDays). */
export function buildSubCampaignScheduledAts(
  start: Date,
  subCount: number,
  scheduleIntervalDays: number
): Date[] {
  if (subCount < 1 || scheduleIntervalDays < 1) return []

  return Array.from({ length: subCount }, (_, index) =>
    addDays(start, index * scheduleIntervalDays)
  )
}

export function requiresSubCampaignSplit(
  recipientCount: number,
  maxPerSub: number = EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB
): boolean {
  return recipientCount > maxPerSub
}

export function estimateSubCampaignCount(
  recipientCount: number,
  maxPerSub: number = EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB
): number {
  if (recipientCount <= 0) return 0
  return Math.ceil(recipientCount / maxPerSub)
}

export { EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY, EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB }
