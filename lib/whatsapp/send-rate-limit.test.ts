import { describe, expect, it, mock } from "bun:test"

const queryRawMock = mock(async () => [{ count: 1 }])

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}))

const { consumeSendRateLimit } = await import("./send-rate-limit")

describe("consumeSendRateLimit", () => {
  it("reserva envio quando o UPSERT retorna uma janela", async () => {
    queryRawMock.mockResolvedValueOnce([{ count: 1 }])
    expect(await consumeSendRateLimit("11111111-1111-4111-8111-111111111111")).toBe(true)
  })

  it("bloqueia envio quando o UPSERT não consegue incrementar", async () => {
    queryRawMock.mockResolvedValueOnce([])
    expect(await consumeSendRateLimit("11111111-1111-4111-8111-111111111111")).toBe(false)
  })
})
