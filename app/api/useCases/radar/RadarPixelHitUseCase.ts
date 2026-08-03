import { Output } from "@/lib/output"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { consumeRadarPixelRateLimit } from "@/lib/radar/pixel-rate-limit"

const PIXEL_RATE_LIMIT = { limit: 60, windowMs: 60_000 }
const ALLOWED_EVENT_TYPES = new Set(["pixel.pageview", "pixel.click"])

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
  | { status: "origin_not_allowed" }
  | { status: "rate_limited"; retryAfterSeconds: number }

class RadarPixelHitUseCase {
  async execute(input: RadarPixelHitInput): Promise<Output> {
    const eventType = ALLOWED_EVENT_TYPES.has(input.eventType) ? input.eventType : "pixel.pageview"

    const config = await radarRepository.findPixelConfigByPublicToken(input.publicToken)
    if (!config) {
      const result: RadarPixelHitResult = { status: "not_found" }
      return new Output(false, [], ["Token não encontrado"], result)
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

    const now = new Date()

    const [{ profile }] = await Promise.all([
      radarRepository.resolveProfileForVisitorSession({
        teamId: config.teamId,
        visitorSession: input.visitorSession,
        lastSeenAt: now,
      }),
      radarRepository.logPixelHit({
        teamId: config.teamId,
        eventType,
        visitorSession: input.visitorSession,
        origin: input.origin,
        userAgent: input.userAgent,
      }),
    ])

    await Promise.all([
      radarRepository.upsertSourceLink({
        profileId: profile.id,
        teamId: config.teamId,
        sourceType: "pixel_hit",
        sourceId: input.visitorSession,
        sourceMetadata: { origin: input.origin, publicToken: input.publicToken },
      }),
      radarRepository.appendEventIfNew({
        profileId: profile.id,
        teamId: config.teamId,
        eventType,
        sourceType: "pixel_hit",
        sourceId: `${input.visitorSession}:${eventType}:${now.toISOString()}`,
        occurredAt: now,
        metadata: { origin: input.origin, publicToken: input.publicToken },
      }),
      radarRepository.touchPixelLastUsed(config.teamId),
    ])

    const result: RadarPixelHitResult = { status: "ok" }
    return new Output(true, ["Hit registrado"], [], result)
  }
}

export const radarPixelHitUseCase = new RadarPixelHitUseCase()
