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
  it("seleciona só quem tem notificação LIGADA e não está deletado", () => {
    const dump: InventoryDumpShape = {
      account: "legacy",
      customers: {
        data: [
          customer({ id: "cus_ligado", notificationDisabled: false }),
          customer({ id: "cus_ja_silenciado", notificationDisabled: true }),
          customer({ id: "cus_deletado", notificationDisabled: false, deleted: true }),
        ],
      },
    }

    const selected = selectCustomersToSilence(dump)

    expect(selected.map((c) => c.id)).toEqual(["cus_ligado"])
  })

  /**
   * Achado P2 da revisão do PR #1207 (thread PRRT_...dNdO): o silenciamento
   * tem duas fases (flag do customer, depois os canais). Se a primeira passa
   * e a segunda falha, o dump seguinte traz `notificationDisabled: true` e o
   * filtro antigo excluía o cliente PARA SEMPRE — canais ligados, M0.5
   * incompleto e invisível. O sinal de conclusão é o ledger, não a flag.
   */
  it("achado P2 PRRT_...dNdO: silenciado mas com backfill incompleto continua elegível ao retry", () => {
    const dump: InventoryDumpShape = {
      account: "legacy",
      customers: {
        data: [
          // Fase 1 concluída, fase 2 falhou → não está no ledger completo.
          customer({ id: "cus_meio_caminho", notificationDisabled: true }),
          customer({ id: "cus_concluido", notificationDisabled: true }),
        ],
      },
    }

    const selected = selectCustomersToSilence(dump, new Set(["cus_concluido"]))

    expect(selected.map((c) => c.id)).toEqual(["cus_meio_caminho"])
  })

  it("controle negativo: quem está no ledger como concluído NÃO é reprocessado", () => {
    const dump: InventoryDumpShape = {
      account: "legacy",
      customers: {
        data: [
          customer({ id: "cus_a", notificationDisabled: true }),
          customer({ id: "cus_b", notificationDisabled: false }),
        ],
      },
    }

    const selected = selectCustomersToSilence(dump, new Set(["cus_a", "cus_b"]))

    expect(selected).toEqual([])
  })

  it("controle negativo: deletado nunca entra, nem com ledger presente", () => {
    const dump: InventoryDumpShape = {
      account: "legacy",
      customers: {
        data: [customer({ id: "cus_deletado", notificationDisabled: false, deleted: true })],
      },
    }

    expect(selectCustomersToSilence(dump, new Set())).toEqual([])
  })

  it("controle negativo: sem ledger disponível, degrada para o comportamento anterior (só flag)", () => {
    const dump: InventoryDumpShape = {
      account: "legacy",
      customers: {
        data: [
          customer({ id: "cus_ligado", notificationDisabled: false }),
          customer({ id: "cus_silenciado", notificationDisabled: true }),
        ],
      },
    }

    expect(selectCustomersToSilence(dump, undefined).map((c) => c.id)).toEqual(["cus_ligado"])
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
