import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { RadarPixelEventPayload } from "@/lib/queues/radar-pixel-events"

const findPixelConfigByPublicToken = mock(async () => ({
  teamId: "team-1",
  allowedOrigins: [] as string[],
}))
const appendEventIfNew = mock(async () => null)
const resolveProfileForVisitorSession = mock(async () => ({
  profile: { id: "profile-1" },
}))
const logPixelHit = mock(async () => ({}))
const upsertSourceLink = mock(async () => ({}))
const touchPixelLastUsed = mock(async () => ({}))

mock.module("@/app/api/infra/data/repositories/radar/RadarRepository", () => ({
  radarRepository: {
    findPixelConfigByPublicToken,
    appendEventIfNew,
    resolveProfileForVisitorSession,
    logPixelHit,
    upsertSourceLink,
    touchPixelLastUsed,
  },
  RadarRepository: class {},
}))

mock.module("@/lib/radar/team-has-radar-feature", () => ({
  teamHasRadarFeature: mock(async () => true),
}))

mock.module("@/lib/radar/pixel-rate-limit", () => ({
  consumeRadarPixelRateLimit: mock(async () => ({ allowed: true, retryAfterSeconds: 0 })),
}))

const { RadarPixelHitUseCase } = await import("@/app/api/useCases/radar/RadarPixelHitUseCase")

const hitInput = {
  publicToken: "tok-1",
  eventType: "pixel.pageview",
  origin: "https://exemplo.com",
  fingerprint: "fp-1",
  visitorSession: "vs-1",
  userAgent: "ua",
}

describe("RadarPixelHitUseCase", () => {
  const publish = mock(async () => ({ messageId: "mid-1" }))

  beforeEach(() => {
    publish.mockClear()
    publish.mockImplementation(async () => ({ messageId: "mid-1" }))
    appendEventIfNew.mockClear()
    findPixelConfigByPublicToken.mockClear()
    findPixelConfigByPublicToken.mockImplementation(async () => ({
      teamId: "team-1",
      allowedOrigins: [],
    }))
    resolveProfileForVisitorSession.mockClear()
    resolveProfileForVisitorSession.mockImplementation(async () => ({
      profile: { id: "profile-1" },
    }))
    logPixelHit.mockClear()
    upsertSourceLink.mockClear()
    touchPixelLastUsed.mockClear()
  })

  it("HTTP feliz publica e não chama appendEventIfNew", async () => {
    const useCase = new RadarPixelHitUseCase({ publish })
    const result = await useCase.execute(hitInput)
    expect(result.isValid).toBe(true)
    expect(publish).toHaveBeenCalledTimes(1)
    expect(appendEventIfNew).not.toHaveBeenCalled()
  })

  it("publish falhou persiste inline", async () => {
    publish.mockImplementation(async () => {
      throw new Error("queue down")
    })
    const useCase = new RadarPixelHitUseCase({ publish })
    const result = await useCase.execute(hitInput)
    expect(result.isValid).toBe(true)
    expect(appendEventIfNew).toHaveBeenCalledTimes(1)
  })

  it("persistQueuedHit escreve o evento", async () => {
    const useCase = new RadarPixelHitUseCase({ publish })
    const payload: RadarPixelEventPayload = {
      teamId: "team-1",
      publicToken: "tok-1",
      eventType: "pixel.pageview",
      visitorSession: "vs-1",
      origin: null,
      userAgent: null,
    }
    const result = await useCase.persistQueuedHit(payload)
    expect(result.isValid).toBe(true)
    expect(appendEventIfNew).toHaveBeenCalledTimes(1)
    expect(publish).not.toHaveBeenCalled()
  })
})
