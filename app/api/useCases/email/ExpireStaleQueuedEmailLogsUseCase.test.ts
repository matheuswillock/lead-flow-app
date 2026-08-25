import { beforeEach, describe, expect, it, mock } from "bun:test"
import {
  ExpireStaleQueuedEmailLogsUseCase,
  QUEUED_EXPIRED_ERROR_MESSAGE,
  type IStaleQueuedEmailLogRepository,
} from "./ExpireStaleQueuedEmailLogsUseCase"

type ExpireOptions = { olderThan: Date; limit: number; errorMessage: string }

const expireStaleQueuedLogs = mock(async (_options: ExpireOptions): Promise<number> => 0)

function buildRepository(): IStaleQueuedEmailLogRepository {
  return { expireStaleQueuedLogs } as unknown as IStaleQueuedEmailLogRepository
}

describe("ExpireStaleQueuedEmailLogsUseCase", () => {
  beforeEach(() => {
    expireStaleQueuedLogs.mockClear()
    expireStaleQueuedLogs.mockImplementation(async () => 0)
  })

  /**
   * T-C2.1 — o contrato com o repositório: só log parado há mais de 48h entra,
   * e a marca é `queued_expired`, nunca reenvio. Reenviar e-mail de 30 dias
   * atrás é dano, não recuperação.
   */
  it("T-C2.1 — expira apenas o que está parado há mais de 48h, marcando queued_expired", async () => {
    expireStaleQueuedLogs.mockImplementation(async () => 660)

    const antes = Date.now()
    const output = await new ExpireStaleQueuedEmailLogsUseCase(buildRepository()).execute()
    const depois = Date.now()

    expect(output.isValid).toBe(true)
    expect(expireStaleQueuedLogs).toHaveBeenCalledTimes(1)

    const options = expireStaleQueuedLogs.mock.calls[0][0]
    const quarentaEOitoHorasMs = 48 * 60 * 60 * 1000
    expect(options.olderThan.getTime()).toBeGreaterThanOrEqual(antes - quarentaEOitoHorasMs)
    expect(options.olderThan.getTime()).toBeLessThanOrEqual(depois - quarentaEOitoHorasMs)
    expect(options.errorMessage).toBe(QUEUED_EXPIRED_ERROR_MESSAGE)
    expect(QUEUED_EXPIRED_ERROR_MESSAGE).toBe("queued_expired")

    expect((output.result as { expired: number }).expired).toBe(660)
  })

  /** Backlog maior que um lote drena em execuções seguintes, e isso é dito. */
  it("T-C2.2 — lote cheio sinaliza backlog remanescente em vez de fingir cobertura", async () => {
    const useCase = new ExpireStaleQueuedEmailLogsUseCase(buildRepository(), { batchSize: 2_000 })
    expireStaleQueuedLogs.mockImplementation(async () => 2_000)

    const output = await useCase.execute()

    const summary = output.result as { expired: number; hasMore: boolean }
    expect(summary.expired).toBe(2_000)
    expect(summary.hasMore).toBe(true)
  })

  it("T-C2.2b — nada parado: execução silenciosa e sem escrita", async () => {
    const output = await new ExpireStaleQueuedEmailLogsUseCase(buildRepository()).execute()

    const summary = output.result as { expired: number; hasMore: boolean }
    expect(summary.expired).toBe(0)
    expect(summary.hasMore).toBe(false)
  })
})
