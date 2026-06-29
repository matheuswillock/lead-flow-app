import type { LeadStatus } from "@prisma/client"

export const RECENT_CAMPAIGN_WINDOW_DAYS = 60
export const PORTFOLIO_RENEWAL_WINDOW_DAYS = 60

export const CRM_CLOSED_STATUSES: LeadStatus[] = ["contract_finalized"]

export const CDP_SEGMENT_SLUGS = [
  "email_marketable",
  "email_blocked",
  "opened_not_clicked",
  "clicked_not_closed",
  "portfolio_renewal_due",
  "inactive_recent_campaign",
] as const

export type CdpSegmentSlug = (typeof CDP_SEGMENT_SLUGS)[number]

export function isCdpSegmentSlug(value: string): value is CdpSegmentSlug {
  return (CDP_SEGMENT_SLUGS as readonly string[]).includes(value)
}
