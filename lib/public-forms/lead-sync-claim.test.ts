import { describe, expect, it } from "bun:test"
import {
  LEAD_SYNC_CLAIM_RETRY_ATTEMPTS,
  LEAD_SYNC_CLAIM_RETRY_DELAY_MS,
  waitForLeadSyncClaimRetry,
} from "./lead-sync-claim"

/**
 * Trava as constantes de produção do claim. Sem asserção de tempo real de
 * propósito: sem `--isolate`, outro arquivo da mesma execução pode ter
 * registrado o mock compartilhado deste módulo
 * (`test/support/public-form-lead-sync-module-mocks.ts`), que espalha o módulo
 * real — constantes sempre reais — mas troca a espera por um no-op. Medir
 * milissegundos aqui viraria flaky por ordem de arquivos.
 */
describe("lead-sync-claim", () => {
  it("mantém as constantes de produção do desenho (3 tentativas × 700ms)", () => {
    expect(LEAD_SYNC_CLAIM_RETRY_ATTEMPTS).toBe(3)
    expect(LEAD_SYNC_CLAIM_RETRY_DELAY_MS).toBe(700)
  })

  it("waitForLeadSyncClaimRetry devolve promise que resolve", async () => {
    await expect(waitForLeadSyncClaimRetry(1)).resolves.toBeUndefined()
  })
})
