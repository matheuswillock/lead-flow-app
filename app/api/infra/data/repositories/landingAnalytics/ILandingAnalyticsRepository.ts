import type { LandingAnalyticsEvent } from "@prisma/client"

export type CreateLandingAnalyticsEventInput = {
  teamId: string
  landingPageId: string
  publicationId: string
  eventId: string
  eventType: string
  schemaVersion: number
  templateSlug: string
  visitorSessionId: string
  campaignId?: string | null
  emailLogId?: string | null
  formId?: string | null
  attribution: object
  metadata: object
  ipHash?: string | null
  userAgent?: string | null
  referrer?: string | null
  occurredAt: Date
}

export interface ILandingAnalyticsRepository {
  createIfAbsent(input: CreateLandingAnalyticsEventInput): Promise<LandingAnalyticsEvent | null>
  findByEventId(eventId: string): Promise<LandingAnalyticsEvent | null>
  summarize(input: LandingAnalyticsSummaryInput): Promise<LandingAnalyticsSummary>
}

export type LandingAnalyticsSummaryInput = {
  teamId: string
  from: Date
  to: Date
  landingPageId?: string
  campaignId?: string
  templateSlug?: string
  formId?: string
  publicationId?: string
}

export type LandingAnalyticsSummary = {
  totals: Record<string, number>
  uniqueVisitors: number
  returningVisitors: number
  byEventType: Array<{ eventType: string; count: number }>
}
