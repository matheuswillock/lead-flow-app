import { describe, expect, it } from "bun:test"
import {
  ORPHAN_RESUME_MIN_AGE_MS,
  resolveEmailCampaignDispatchWakeQueue,
  STUCK_SENDING_THRESHOLD_MS,
} from "./dispatch-wake-queue"

describe("resolveEmailCampaignDispatchWakeQueue", () => {
  const now = new Date("2026-08-20T12:00:00.000Z")

  it("idade abaixo de 30 min publica na fila principal", () => {
    const createdAt = new Date(now.getTime() - STUCK_SENDING_THRESHOLD_MS + 1_000)
    expect(resolveEmailCampaignDispatchWakeQueue({ createdAt, now })).toBe("main")
  })

  it("idade igual a 30 min publica na overflow", () => {
    const createdAt = new Date(now.getTime() - STUCK_SENDING_THRESHOLD_MS)
    expect(resolveEmailCampaignDispatchWakeQueue({ createdAt, now })).toBe("overflow")
  })

  it("idade acima de 30 min publica na overflow", () => {
    const createdAt = new Date(now.getTime() - STUCK_SENDING_THRESHOLD_MS - 60_000)
    expect(resolveEmailCampaignDispatchWakeQueue({ createdAt, now })).toBe("overflow")
  })
})

describe("limiares de reclaim", () => {
  it("minAge de órfão é 2 min e overflow é 30 min", () => {
    expect(ORPHAN_RESUME_MIN_AGE_MS).toBe(2 * 60 * 1000)
    expect(STUCK_SENDING_THRESHOLD_MS).toBe(30 * 60 * 1000)
  })
})
