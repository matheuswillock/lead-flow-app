import { describe, expect, it } from "bun:test"
import {
  assertApplyAuthorized,
  assertLegacyAccountDump,
  parseSilenceArgs,
  selectCustomersToSilence,
  summarizeSilenceRun,
  type InventoryDumpShape,
} from "./silenceAsaasCustomersLogic"
import type { AsaasCustomer } from "./asaasInventoryTypes"

function customer(overrides: Partial<AsaasCustomer> = {}): AsaasCustomer {
  return {
    id: "cus_1",
    name: "Cliente Teste",
    email: "cliente@example.com",
    notificationDisabled: false,
    ...overrides,
  }
}

describe("parseSilenceArgs (C7 — entrada sempre do inventário, nunca lista embutida)", () => {
  it("exige --input=<path>", () => {
    expect(() => parseSilenceArgs([])).toThrow(/--input/)
  })

  it("--apply vira flag true; ausente vira false (dry-run default)", () => {
    expect(parseSilenceArgs(["--input=dump.json"]).apply).toBe(false)
    expect(parseSilenceArgs(["--input=dump.json", "--apply"]).apply).toBe(true)
  })
})

describe("assertApplyAuthorized (T-30.5)", () => {
  it("dry-run (sem --apply) nunca precisa da env — passa sempre", () => {
    expect(() =>
      assertApplyAuthorized({ input: "x", apply: false }, {})
    ).not.toThrow()
  })

  it("--apply sem ASAAS_SILENCE_CUSTOMERS_APPLY=1 aborta", () => {
    expect(() =>
      assertApplyAuthorized({ input: "x", apply: true }, {})
    ).toThrow(/ASAAS_SILENCE_CUSTOMERS_APPLY/)
  })

  it("--apply com ASAAS_SILENCE_CUSTOMERS_APPLY=1 passa", () => {
    expect(() =>
      assertApplyAuthorized(
        { input: "x", apply: true },
        { ASAAS_SILENCE_CUSTOMERS_APPLY: "1" }
      )
    ).not.toThrow()
  })

  it("--apply com o valor errado (ex.: 'true') ainda aborta — só '1' autoriza", () => {
    expect(() =>
      assertApplyAuthorized(
        { input: "x", apply: true },
        { ASAAS_SILENCE_CUSTOMERS_APPLY: "true" }
      )
    ).toThrow(/ASAAS_SILENCE_CUSTOMERS_APPLY/)
  })
})

describe("assertLegacyAccountDump (achado P1 da revisão — cursor + codex)", () => {
  it("dump legacy passa — é o escopo do estágio E2", () => {
    expect(() =>
      assertLegacyAccountDump({ account: "legacy", customers: { data: [] } })
    ).not.toThrow()
  })

  it("dump primary é RECUSADO: silenciar a conta nova desligaria a cobrança dos clientes ativos", () => {
    expect(() =>
      assertLegacyAccountDump({ account: "primary", customers: { data: [] } })
    ).toThrow(/apenas a conta "legacy"/)
  })
})

describe("selectCustomersToSilence (T-30.6 — C7)", () => {
  /**
   * Achados P2 da revisão do PR #1207 (threads PRRT_...dNdO e ...eDvF): a
   * seleção não pula ninguém. Filtrar por `notificationDisabled` excluía
   * para sempre quem falhou na 2ª fase (canais) depois da 1ª ter passado;
   * filtrar pelo ledger `AsaasNotificationBackfill` reintroduz o mesmo erro
   * por outro caminho, porque ele é chaveado só por `asaasCustomerId` e
   * `cus_` é escopado por conta no Asaas. As chamadas do gateway são
   * idempotentes, então processar todo mundo é o desenho seguro.
   */
  it("achados P2 dNdO/eDvF: seleciona TODO customer não deletado, inclusive o já silenciado", () => {
    const dump: InventoryDumpShape = {
      account: "legacy",
      customers: {
        data: [
          customer({ id: "cus_ligado", notificationDisabled: false }),
          // 1ª fase concluída, 2ª pode ter falhado — continua elegível.
          customer({ id: "cus_ja_silenciado", notificationDisabled: true }),
          customer({ id: "cus_deletado", notificationDisabled: false, deleted: true }),
        ],
      },
    }

    const selected = selectCustomersToSilence(dump)

    expect(selected.map((c) => c.id)).toEqual(["cus_ligado", "cus_ja_silenciado"])
  })

  it("controle negativo: deletado nunca entra", () => {
    const dump: InventoryDumpShape = {
      account: "legacy",
      customers: {
        data: [
          customer({ id: "cus_deletado_a", notificationDisabled: false, deleted: true }),
          customer({ id: "cus_deletado_b", notificationDisabled: true, deleted: true }),
        ],
      },
    }

    expect(selectCustomersToSilence(dump)).toEqual([])
  })

  it("dump vazio -> lista vazia (nunca lança)", () => {
    const dump: InventoryDumpShape = { account: "legacy", customers: { data: [] } }
    expect(selectCustomersToSilence(dump)).toEqual([])
  })
})

describe("summarizeSilenceRun", () => {
  it("agrega sucesso/falha corretamente, dry-run conta como sucesso (nada foi escrito, mas nada falhou)", () => {
    const summary = summarizeSilenceRun("legacy", false, [
      { customerId: "1", email: "a@a.com", outcome: "dry-run", channelsDisabledCount: 0 },
      { customerId: "2", email: "b@b.com", outcome: "failed", channelsDisabledCount: 0, error: "x" },
    ])

    expect(summary.totalCandidates).toBe(2)
    expect(summary.succeeded).toBe(1)
    expect(summary.failed).toBe(1)
  })
})
