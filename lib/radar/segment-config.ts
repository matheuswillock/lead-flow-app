import type { LeadStatus } from "@prisma/client"

export const RECENT_CAMPAIGN_WINDOW_DAYS = 60
export const PORTFOLIO_RENEWAL_WINDOW_DAYS = 60

export const CRM_CLOSED_STATUSES: LeadStatus[] = ["contract_finalized"]

export const RADAR_SEGMENT_SLUGS = [
  "email_marketable",
  "email_blocked",
  "opened_not_clicked",
  "clicked_not_closed",
  "portfolio_renewal_due",
  "inactive_recent_campaign",
  "portfolio_clients",
  "crm_clients",
] as const

export type RadarSegmentSlug = (typeof RADAR_SEGMENT_SLUGS)[number]

export function isRadarSegmentSlug(value: string): value is RadarSegmentSlug {
  return (RADAR_SEGMENT_SLUGS as readonly string[]).includes(value)
}
