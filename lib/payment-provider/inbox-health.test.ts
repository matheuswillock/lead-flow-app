import { describe, expect, it } from "bun:test"
import {
  INBOX_FAILED_ALERT_THRESHOLD,
  INBOX_STALLED_ALERT_MINUTES,
  evaluateInboxHealth,
} from "./inbox-health"

const NOW = new Date("2026-10-21T12:00:00.000Z")
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000)

describe("evaluateInboxHealth (PAY-HARD-T007)", () => {
  it("usa N=5 falhas e M=30 minutos como limites iniciais", () => {
    expect(INBOX_FAILED_ALERT_THRESHOLD).toBe(5)
    expect(INBOX_STALLED_ALERT_MINUTES).toBe(30)
  })

  it("saudável com poucas falhas e nada parado", () => {
    expect(evaluateInboxHealth({ failedCount: 5, oldestUnfinishedAt: minutesAgo(30) }, NOW)).toEqual({
      healthy: true,
      reasons: [],
    })
  })

  it("alerta quando as falhas passam do limite", () => {
    const result = evaluateInboxHealth({ failedCount: 6, oldestUnfinishedAt: null }, NOW)
    expect(result.healthy).toBe(false)
    expect(result.reasons).toEqual(["FAILED_ABOVE_LIMIT"])
  })

  it("alerta quando há evento sem andamento por mais de M minutos", () => {
    const result = evaluateInboxHealth({ failedCount: 0, oldestUnfinishedAt: minutesAgo(31) }, NOW)
    expect(result.reasons).toEqual(["STALLED_TOO_LONG"])
  })

  it("aceita limites configuráveis e acumula motivos", () => {
    const result = evaluateInboxHealth(
      { failedCount: 2, oldestUnfinishedAt: minutesAgo(10) },
      NOW,
      { failedThreshold: 1, stalledMinutes: 5 },
    )
    expect(result.reasons).toEqual(["FAILED_ABOVE_LIMIT", "STALLED_TOO_LONG"])
  })
})
