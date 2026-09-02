import { describe, expect, it } from "bun:test"
import {
  LEAD_SYNC_CLAIM_RETRY_ATTEMPTS,
  LEAD_SYNC_CLAIM_RETRY_DELAY_MS,
  waitForLeadSyncClaimRetry,
} from "./lead-sync-claim"

describe("lead-sync-claim", () => {
  it("mantém as constantes de produção do desenho (3 tentativas × 700ms)", () => {
    expect(LEAD_SYNC_CLAIM_RETRY_ATTEMPTS).toBe(3)
    expect(LEAD_SYNC_CLAIM_RETRY_DELAY_MS).toBe(700)
  })

  it("waitForLeadSyncClaimRetry resolve depois do tempo pedido", async () => {
    const start = performance.now()
    await waitForLeadSyncClaimRetry(20)
    expect(performance.now() - start).toBeGreaterThanOrEqual(15)
  })
})
