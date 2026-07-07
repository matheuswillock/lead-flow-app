import { describe, expect, it, mock } from "bun:test"

const countMock = mock(async () => 5)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    whatsAppUsageEvent: {
      count: countMock,
    },
  },
}))

const { isWithinSendRateLimit, SEND_RATE_LIMIT_MAX_PER_WINDOW } = await import("./send-rate-limit")

describe("isWithinSendRateLimit", () => {
  it("permite envio abaixo do limite", async () => {
    countMock.mockResolvedValueOnce(SEND_RATE_LIMIT_MAX_PER_WINDOW - 1)
    expect(await isWithinSendRateLimit("team-1")).toBe(true)
  })

  it("bloqueia envio no limite", async () => {
    countMock.mockResolvedValueOnce(SEND_RATE_LIMIT_MAX_PER_WINDOW)
    expect(await isWithinSendRateLimit("team-1")).toBe(false)
  })
})
