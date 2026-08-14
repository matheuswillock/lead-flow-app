import { Output } from "@/lib/output"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { consumeRadarPixelRateLimit } from "@/lib/radar/pixel-rate-limit"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import type { RadarPixelEventPayload } from "@/lib/queues/radar-pixel-events"

const PIXEL_RATE_LIMIT = { limit: 60, windowMs: 60_000 }
const ALLOWED_EVENT_TYPES = new Set(["pixel.pageview", "pixel.click"])
const RADAR_PIXEL_EVENTS_QUEUE_PUBLISH_FAILED_TAG = "radar_pixel_events_queue_publish_failed"

function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) return true
  if (!origin) return false
  return allowedOrigins.some((allowed) => {
    try {
      return new URL(allowed).origin === new URL(origin).origin
    } catch {
      return false
    }
  })
}

export type RadarPixelHitInput = {
  publicToken: string
  eventType: string
  origin: string | null
  fingerprint: string
  visitorSession: string
  userAgent: string | null
}

export type RadarPixelHitResult =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "feature_disabled" }
  | { status: "origin_not_allowed" }
  | { status: "rate_limited"; retryAfterSeconds: number }

type PublishRadarPixelEvent = (
  payload: RadarPixelEventPayload
) => Promise<{ messageId: string | null }>

async function defaultPublish(payload: RadarPixelEventPayload): Promise<{ messageId: string | null }> {
  const { publishRadarPixelEvent } = await import("@/lib/queues/radar-pixel-events")
  return publishRadarPixelEvent(payload)
}

export type RadarPixelHitDeps = {
  publish?: PublishRadarPixelEvent
}

export class RadarPixelHitUseCase {
  constructor(private readonly deps: RadarPixelHitDeps = {}) {}

  async execute(input: RadarPixelHitInput): Promise<Output> {
    const eventType = ALLOWED_EVENT_TYPES.has(input.eventType) ? input.eventType : "pixel.pageview"

    const config = await radarRepository.findPixelConfigByPublicToken(input.publicToken)
    if (!config) {
      const result: RadarPixelHitResult = { status: "not_found" }
      return new Output(false, [], ["Token não encontrado"], result)
    }

    const hasFeature = await teamHasRadarFeature(config.teamId)
    if (!hasFeature) {
      const result: RadarPixelHitResult = { status: "feature_disabled" }
      return new Output(false, [], ["Recurso não disponível"], result)
    }

    if (!isOriginAllowed(input.origin, config.allowedOrigins)) {
      const result: RadarPixelHitResult = { status: "origin_not_allowed" }
      return new Output(false, [], ["Origem não autorizada"], result)
    }

    const rateLimitKey = `pixel:${config.teamId}:${input.fingerprint}`
    const { allowed, retryAfterSeconds } = await consumeRadarPixelRateLimit(rateLimitKey, PIXEL_RATE_LIMIT)
    if (!allowed) {
      const result: RadarPixelHitResult = { status: "rate_limited", retryAfterSeconds }
      return new Output(false, [], ["Rate limit excedido"], result)
    }

    const payload: RadarPixelEventPayload = {
      teamId: config.teamId,
      publicToken: input.publicToken,
      eventType,
      visitorSession: input.visitorSession,
      origin: input.origin,
      userAgent: input.userAgent,
    }

    const publish = this.deps.publish ?? defaultPublish
    try {
      await publish(payload)
    } catch (error) {
      console.error(`[RadarPixelHitUseCase][execute] ${RADAR_PIXEL_EVENTS_QUEUE_PUBLISH_FAILED_TAG}`, error)
      await this.persistQueuedHit(payload)
    }

    const result: RadarPixelHitResult = { status: "ok" }
    return new Output(true, ["Hit registrado"], [], result)
  }

  async persistQueuedHit(payload: RadarPixelEventPayload): Promise<Output> {
    const eventType = ALLOWED_EVENT_TYPES.has(payload.eventType) ? payload.eventType : "pixel.pageview"
    const now = new Date()
    const dayKey = now.toISOString().slice(0, 10)

    const [{ profile }] = await Promise.all([
      radarRepository.resolveProfileForVisitorSession({
        teamId: payload.teamId,
        visitorSession: payload.visitorSession,
        lastSeenAt: now,
      }),
      radarRepository.logPixelHit({
        teamId: payload.teamId,
        eventType,
        visitorSession: payload.visitorSession,
        origin: payload.origin,
        userAgent: payload.userAgent,
      }),
    ])

    await Promise.all([
      radarRepository.upsertSourceLink({
        profileId: profile.id,
        teamId: payload.teamId,
        sourceType: "pixel_hit",
        sourceId: payload.visitorSession,
        sourceMetadata: { origin: payload.origin, publicToken: payload.publicToken },
      }),
      radarRepository.appendEventIfNew({
        profileId: profile.id,
        teamId: payload.teamId,
        eventType,
        sourceType: "pixel_hit",
        sourceId: `${payload.visitorSession}:${eventType}:${dayKey}`,
        occurredAt: now,
        metadata: { origin: payload.origin, publicToken: payload.publicToken },
      }),
      radarRepository.touchPixelLastUsed(payload.teamId),
    ])

    const result: RadarPixelHitResult = { status: "ok" }
    return new Output(true, ["Hit registrado"], [], result)
  }
}

export const radarPixelHitUseCase = new RadarPixelHitUseCase()
