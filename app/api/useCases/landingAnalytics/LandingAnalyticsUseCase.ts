import { landingPageUseCase } from "@/app/api/useCases/landingPages/LandingPageUseCase"
import { createHash } from "node:crypto"
import { landingAnalyticsRepository } from "@/app/api/infra/data/repositories/landingAnalytics/LandingAnalyticsRepository"
import { outboundEventPublisher } from "@/app/api/services/teamWebhook/OutboundEventPublisher"
import { Output } from "@/lib/output"
import { landingAnalyticsEventSchema, sanitizeLandingEvent } from "@/lib/landing-analytics/events"

export class LandingAnalyticsUseCase {
  async record(publicId: string, input: unknown, request: Request) {
    const parsed = landingAnalyticsEventSchema.safeParse(input)
    if (!parsed.success) return new Output(false, [], ["Evento inválido"], null)
    const landing = await landingPageUseCase.getPublic(publicId)
    if (!landing.isValid || !landing.result) return new Output(false, [], ["Landing page indisponível"], null)
    const landingData = landing.result as {
      teamId: string
      publicFormId: string
      snapshot: { landingPageId: string; publicationId?: string; templateSlug: string }
    }
    if (
      landingData.snapshot.landingPageId !== parsed.data.landingPageId ||
      landingData.snapshot.publicationId !== parsed.data.publicationId ||
      landingData.snapshot.templateSlug !== parsed.data.templateSlug
    ) {
      return new Output(false, [], ["Publicação incompatível"], null)
    }
    const event = await landingAnalyticsRepository.createIfAbsent({
      teamId: landingData.teamId,
      landingPageId: parsed.data.landingPageId,
      publicationId: parsed.data.publicationId,
      eventId: parsed.data.eventId,
      eventType: parsed.data.eventType,
      schemaVersion: parsed.data.schemaVersion,
      templateSlug: parsed.data.templateSlug,
      visitorSessionId: parsed.data.visitorSessionId,
      campaignId: toUuid(parsed.data.attribution.campaignId),
      emailLogId: toUuid(parsed.data.attribution.emailLogId),
      formId: landingData.publicFormId,
      attribution: parsed.data.attribution,
      metadata: sanitizeLandingEvent(parsed.data.metadata),
      ipHash: hashIp(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()),
      userAgent: request.headers.get("user-agent"),
      referrer: request.headers.get("referer"),
      occurredAt: new Date(parsed.data.occurredAt),
    })
    if (event) {
      await outboundEventPublisher.publish({
        teamId: landingData.teamId,
        eventKey: "landing_analytics_event",
        occurredAt: parsed.data.occurredAt,
        payload: { ...parsed.data, metadata: sanitizeLandingEvent(parsed.data.metadata) },
      })
    }
    return new Output(true, [], [], { accepted: true })
  }
}

function toUuid(value: string | undefined) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

function hashIp(ip: string | undefined) {
  if (!ip) return null
  const salt = process.env.LANDING_ANALYTICS_IP_SALT
  return salt ? createHash("sha256").update(`${salt}:${ip}`).digest("hex") : null
}

export const landingAnalyticsUseCase = new LandingAnalyticsUseCase()
