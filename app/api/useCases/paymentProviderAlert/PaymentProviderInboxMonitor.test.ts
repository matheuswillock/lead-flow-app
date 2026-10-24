import { describe, expect, it, mock } from "bun:test"
import { PaymentProviderInboxMonitor } from "./PaymentProviderInboxMonitor"

const NOW = new Date("2026-10-21T12:00:00.000Z")

function build(snapshot: { failedCount: number; oldestUnfinishedAt: Date | null }) {
  const getHealthSnapshot = mock(async (_input: { failedSince: Date }) => snapshot)
  const alert = mock(async (_input: unknown) => undefined)
  const monitor = new PaymentProviderInboxMonitor({ inbox: { getHealthSnapshot }, alerter: { alert }, now: () => NOW })
  return { monitor, getHealthSnapshot, alert }
}

describe("PaymentProviderInboxMonitor", () => {
  it("inbox saudável não alerta", async () => {
    const { monitor, alert } = build({ failedCount: 0, oldestUnfinishedAt: null })
    expect((await monitor.check()).healthy).toBe(true)
    expect(alert).not.toHaveBeenCalled()
  })

  it("falhas acima do limite disparam alerta Slack + Sentry deduplicado", async () => {
    const { monitor, alert } = build({ failedCount: 9, oldestUnfinishedAt: null })
    const result = await monitor.check()
    expect(result.healthy).toBe(false)
    expect(alert.mock.calls[0]?.[0]).toMatchObject({
      key: "payment-inbox-unhealthy",
      level: "error",
      slack: true,
      dedupeWindowMs: expect.any(Number),
      context: { failedCount: 9, reasons: ["FAILED_ABOVE_LIMIT"] },
    })
  })

  it("evento sem andamento por mais de 30 minutos dispara alerta", async () => {
    const { monitor, alert } = build({ failedCount: 0, oldestUnfinishedAt: new Date(NOW.getTime() - 45 * 60_000) })
    await monitor.check()
    expect(alert.mock.calls[0]?.[0]).toMatchObject({ context: { reasons: ["STALLED_TOO_LONG"] } })
  })

  it("falha ao consultar a inbox não derruba o cron", async () => {
    const { monitor, getHealthSnapshot } = build({ failedCount: 0, oldestUnfinishedAt: null })
    getHealthSnapshot.mockImplementationOnce(async () => {
      throw new Error("db")
    })
    expect((await monitor.check()).healthy).toBe(true)
  })
})
