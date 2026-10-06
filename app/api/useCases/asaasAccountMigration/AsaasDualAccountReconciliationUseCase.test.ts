import { beforeEach, describe, expect, it, mock } from "bun:test"

const captureMessageMock = mock((_message: string, _context?: Record<string, unknown>) => "")
mock.module("@sentry/nextjs", () => ({ captureMessage: captureMessageMock }))

const { AsaasDualAccountReconciliationUseCase } = await import(
  "./AsaasDualAccountReconciliationUseCase"
)

type FakeGateway = { accountId: "primary" | "legacy"; fetchPage: () => never }

function buildDeps(overrides: {
  customersByAccount?: Record<string, Array<{ id: string; notificationDisabled: boolean }>>
  subscriptionsByAccount?: Record<string, unknown[]>
  dbCustomerPointersByAccount?: Record<
    string,
    Array<{
      refId: string
      source: "profile" | "adhesion" | "backofficeClient"
      asaasCustomerId: string
      email: string | null
    }>
  >
  staleRows?: Array<{ legacyCustomerId: string; status: string; updatedAt: Date }>
  now?: Date
} = {}) {
  const now = overrides.now ?? new Date("2026-09-18T00:00:00.000Z")

  return {
    now: () => now,
    createGateway: (account: "primary" | "legacy"): FakeGateway => ({
      accountId: account,
      fetchPage: () => {
        throw new Error("não deveria ser chamado diretamente — use fetchAllPages")
      },
    }),
    inventoryRepository: {
      listCustomerPointers: async (account: "primary" | "legacy") =>
        overrides.dbCustomerPointersByAccount?.[account] ?? [],
      listSubscriptionPointers: async () => [],
    },
    ledgerRepository: {
      upsertSnapshot: async () => ({}) as never,
      findByLegacyCustomerId: async () => null,
      transition: async () => ({}) as never,
      countAll: async () => 0,
      listNonTerminalStaleSince: async () =>
        (overrides.staleRows ?? []).map((row) => ({
          ...row,
          id: "id",
          profileId: "profile",
          clientName: "Cliente",
          clientEmail: "cliente@example.com",
          legacySubscriptionId: null,
          primaryCustomerId: null,
          primarySubscriptionId: null,
          billingType: null,
          cycle: null,
          value: null,
          nextDueDate: null,
          notificationsDisabled: false,
          anomalyNotes: null,
          attemptCount: 0,
          lastError: null,
          migratedAt: null,
          createdAt: new Date(),
        })) as never,
      markNotificationsDisabled: async () => false,
    },
  }
}

// Substitui fetchAllPages/gateway real por um mock simples via mock.module,
// já que o UseCase importa `fetchAllPages` de scripts/billing/lib.
const fetchAllPagesMock = mock(async (gateway: FakeGateway, path: string) => {
  if (path === "/customers") return customersFixture[gateway.accountId] ?? []
  return []
})
let customersFixture: Record<string, Array<{ id: string }>> = {}

mock.module("@/scripts/billing/lib/asaasReadOnlyGateway", () => ({
  AsaasReadOnlyGateway: class {
    accountId: string
    constructor(accountId: string) {
      this.accountId = accountId
    }
    fetchPage() {
      throw new Error("unused")
    }
  },
  fetchAllPages: fetchAllPagesMock,
}))

describe("AsaasDualAccountReconciliationUseCase (T-30.25 — E7/X3)", () => {
  beforeEach(() => {
    captureMessageMock.mockClear()
    fetchAllPagesMock.mockClear()
    customersFixture = {}
  })

  it("tudo íntegro e ledger todo terminal -> sem alerta (sem ruído)", async () => {
    customersFixture = { primary: [{ id: "cus_1" }], legacy: [] }
    const deps = buildDeps({
      dbCustomerPointersByAccount: {
        primary: [{ refId: "p1", source: "profile", asaasCustomerId: "cus_1", email: null }],
      },
    })

    const useCase = new AsaasDualAccountReconciliationUseCase(deps)
    const output = await useCase.execute()

    expect(output.isValid).toBe(true)
    expect(captureMessageMock).not.toHaveBeenCalled()
  })

  it("ponteiro órfão (no banco, ausente no Asaas) vira divergência nomeada e dispara alerta", async () => {
    customersFixture = { primary: [], legacy: [] }
    const deps = buildDeps({
      dbCustomerPointersByAccount: {
        primary: [
          { refId: "p1", source: "profile", asaasCustomerId: "cus_orfao", email: "a@b.com" },
        ],
      },
    })

    const useCase = new AsaasDualAccountReconciliationUseCase(deps)
    const output = await useCase.execute()

    const report = output.result as {
      byAccount: { primary: { divergences: Array<{ code: string }> } }
    }
    expect(report.byAccount.primary.divergences.some((d) => d.code === "ORFAO")).toBe(true)
    expect(captureMessageMock).toHaveBeenCalledTimes(1)
  })

  it("linha do ledger envelhecida (>24h fora de done/failed/requires_card_reauth) dispara alerta", async () => {
    const deps = buildDeps({
      staleRows: [
        {
          legacyCustomerId: "cus_travado",
          status: "customer_created",
          updatedAt: new Date("2026-09-15T00:00:00.000Z"),
        },
      ],
    })

    const useCase = new AsaasDualAccountReconciliationUseCase(deps)
    const output = await useCase.execute()

    const report = output.result as { staleLedgerRows: Array<{ legacyCustomerId: string }> }
    expect(report.staleLedgerRows).toHaveLength(1)
    expect(report.staleLedgerRows[0]?.legacyCustomerId).toBe("cus_travado")
    expect(captureMessageMock).toHaveBeenCalledTimes(1)
  })

  it("falha ao buscar uma conta não derruba o cron inteiro — registra o erro e segue", async () => {
    const brokenGateway = {
      createGateway: () => {
        throw new Error("conta legacy não provisionada")
      },
    }
    fetchAllPagesMock.mockImplementation(async () => {
      throw new Error("conta legacy não provisionada")
    })

    const deps = { ...buildDeps(), ...brokenGateway }
    const useCase = new AsaasDualAccountReconciliationUseCase(deps)

    const output = await useCase.execute()

    expect(output.isValid).toBe(true)
    const report = output.result as {
      byAccount: Record<string, { error: string | null }>
    }
    expect(report.byAccount.primary.error).toMatch(/não provisionada/)
    expect(report.byAccount.legacy.error).toMatch(/não provisionada/)
  })

  it("achado P1 (codex): falha de reconciliação NÃO pode ser silenciosa — alerta com level error", async () => {
    fetchAllPagesMock.mockImplementation(async () => {
      throw new Error("Asaas 503 Service Unavailable")
    })

    const useCase = new AsaasDualAccountReconciliationUseCase(buildDeps())
    await useCase.execute()

    expect(captureMessageMock).toHaveBeenCalledTimes(1)
    const [message, context] = captureMessageMock.mock.calls[0] as [
      string,
      { level: string; extra: { failures: Array<{ account: string; error: string }> } },
    ]
    expect(message).toMatch(/reconciliação falhou/)
    // Falha escala acima de "warning": a janela dual ficou sem verificação.
    expect(context.level).toBe("error")
    expect(context.extra.failures).toHaveLength(2)
  })

  it("conta legacy ainda não provisionada (pré-cutover) NÃO alerta — seria ruído diário garantido", async () => {
    fetchAllPagesMock.mockImplementation(async (gateway: FakeGateway) => {
      if (gateway.accountId === "legacy") {
        throw new Error(
          "Conta Asaas 'legacy' solicitada, mas ASAAS_LEGACY_API_KEY não está configurada"
        )
      }
      return []
    })

    const useCase = new AsaasDualAccountReconciliationUseCase(buildDeps())
    await useCase.execute()

    expect(captureMessageMock).not.toHaveBeenCalled()
  })
})
