import { landingPageUseCase } from "@/app/api/useCases/landingPages/LandingPageUseCase"
import { createHash } from "node:crypto"
import { landingAnalyticsRepository } from "@/app/api/infra/data/repositories/landingAnalytics/LandingAnalyticsRepository"
import { outboundEventPublisher } from "@/app/api/services/teamWebhook/OutboundEventPublisher"
import { Output } from "@/lib/output"
import { landingAnalyticsEventSchema, sanitizeLandingEvent } from "@/lib/landing-analytics/events"
import { consumePublicFormRateLimit, publicFormRequestFingerprint } from "@/lib/public-forms/rate-limit"

const EVENT_MAX_AGE_MS = 15 * 60 * 1000
const EVENT_MAX_FUTURE_MS = 5 * 60 * 1000
const EVENT_RATE_LIMIT = { limit: 120, windowMs: 60_000 }

export class LandingAnalyticsUseCase {
  async record(publicId: string, input: unknown, request: Request) {
    const parsed = landingAnalyticsEventSchema.safeParse(input)
    if (!parsed.success) return new Output(false, [], ["Evento inválido"], null)
    const occurredAt = new Date(parsed.data.occurredAt)
    const now = Date.now()
    if (occurredAt.getTime() < now - EVENT_MAX_AGE_MS || occurredAt.getTime() > now + EVENT_MAX_FUTURE_MS) {
      return new Output(false, [], ["Timestamp do evento fora da janela permitida"], null)
    }
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
    const ipFingerprint = publicFormRequestFingerprint(request)
    const rateLimitKeys = [
      `landing-analytics:team:${landingData.teamId}`,
      `landing-analytics:landing:${parsed.data.landingPageId}`,
      `landing-analytics:session:${parsed.data.visitorSessionId}`,
      `landing-analytics:ip:${ipFingerprint}`,
    ]
    for (const key of rateLimitKeys) {
      const rateLimit = await consumePublicFormRateLimit(key, EVENT_RATE_LIMIT)
      if (!rateLimit.allowed) {
        return new Output(false, [], ["Limite de eventos excedido"], { retryAfterSeconds: rateLimit.retryAfterSeconds })
      }
    }
    const sanitizedMetadata = sanitizeLandingEvent(parsed.data.metadata)
    const existing = await landingAnalyticsRepository.findByEventId(parsed.data.eventId)
    if (existing) {
      if (isSameEvent(existing, parsed.data, sanitizedMetadata)) {
        return new Output(true, [], [], { accepted: true, duplicate: true })
      }
      return new Output(false, [], ["eventId já utilizado com payload diferente"], null)
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
      metadata: sanitizedMetadata,
      ipHash: hashIp(ipFingerprint),
      userAgent: request.headers.get("user-agent"),
      referrer: request.headers.get("referer"),
      occurredAt,
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

function isSameEvent(existing: {
  eventType: string; schemaVersion: number; landingPageId: string; publicationId: string;
  templateSlug: string; visitorSessionId: string; occurredAt: Date; metadata: unknown
}, input: {
  eventType: string; schemaVersion: number; landingPageId: string; publicationId: string;
  templateSlug: string; visitorSessionId: string; occurredAt: string
}, metadata: Record<string, unknown>) {
  return existing.eventType === input.eventType && existing.schemaVersion === input.schemaVersion &&
    existing.landingPageId === input.landingPageId && existing.publicationId === input.publicationId &&
    existing.templateSlug === input.templateSlug && existing.visitorSessionId === input.visitorSessionId &&
    existing.occurredAt.getTime() === new Date(input.occurredAt).getTime() &&
    stableJson(existing.metadata) === stableJson(metadata)
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`
  }
  return JSON.stringify(value)
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
