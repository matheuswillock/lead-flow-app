import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  BackofficeAdhesionWithRelations,
  IBackofficeAdhesionRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/IBackofficeAdhesionRepository"

// C33: createAsaasPayment, chargePendingInstallments e cancelAsaasPayments
// operam sobre uma adesão que já existe (e já tem uma conta gravada), mas
// até aqui criavam/cancelavam a cobrança sempre via asaasFetch — cliente
// fixo na primary. Uma adesão legacy (pré-migration) teria a cobrança
// criada/cancelada na conta errada (achado cursor[bot] no PR #1100,
// RUN_ID bc-7d02ec64).
const requestMock = mock(async (_endpoint: string, _init?: RequestInit) => ({
  id: "pay_new",
  invoiceUrl: "https://sandbox.asaas.com/i/pay_new",
}))
const createAsaasClientMock = mock((accountId: string) => ({
  endpoints: {
    payments: `https://asaas.test/${accountId}/payments`,
    pixQrCode: (paymentId: string) => `https://asaas.test/${accountId}/payments/${paymentId}/pixQrCode`,
  },
  request: requestMock,
}))
mock.module("@/lib/asaas", () => ({
  createAsaasClient: createAsaasClientMock,
  // BackofficeAdhesionService.ts importa o gateway de customer
  // transitivamente (AsaasCustomerGateway.ts), que ainda usa asaasFetch —
  // mock.module substitui o módulo inteiro, então precisa satisfazer os
  // dois consumidores.
  asaasFetch: mock(async () => ({ id: "cus_unused" })),
  asaasApi: { customers: "https://asaas.test/primary/customers" },
}))

const { BackofficeAdhesionService } = await import("./BackofficeAdhesionService")

function buildAdhesion(
  overrides: Partial<BackofficeAdhesionWithRelations>
): BackofficeAdhesionWithRelations {
  return {
    id: "adhesion-1",
    cycle: "monthly",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    asaasAccount: "legacy",
    ...overrides,
  } as BackofficeAdhesionWithRelations
}

describe("BackofficeAdhesionService — writers de cobrança usam a conta da adesão (C33)", () => {
  beforeEach(() => {
    requestMock.mockClear()
    createAsaasClientMock.mockClear()
    requestMock.mockImplementation(async () => ({ id: "pay_new", invoiceUrl: "https://x/i" }))
  })

  it("createAsaasPayment (adesão legacy) → cria a cobrança via createAsaasClient('legacy')", async () => {
    const repo = {} as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)
    const adhesion = buildAdhesion({ asaasAccount: "legacy" })

    await (service as any).createAsaasPayment(
      adhesion,
      "cus_1",
      { billingType: "PIX" },
      100
    )

    expect(createAsaasClientMock).toHaveBeenCalledWith("legacy")
    expect(requestMock.mock.calls[0][0]).toContain("/legacy/payments")
  })

  it("chargePendingInstallments (adesão legacy) → cria as parcelas via createAsaasClient('legacy')", async () => {
    const repo = {} as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)
    const adhesion = buildAdhesion({ asaasAccount: "legacy" })

    await (service as any).chargePendingInstallments({
      adhesion,
      customerId: "cus_1",
      email: "a@b.com",
      billingType: "PIX",
      ledger: [],
      pending: [{ index: 0, amount: 50, paymentSource: "ASAAS", status: "pending", asaasPaymentId: null, paidAt: null }],
    })

    expect(createAsaasClientMock).toHaveBeenCalledWith("legacy")
    expect(requestMock.mock.calls[0][0]).toContain("/legacy/payments")
  })

  it("cancelAsaasPayments recebe a conta explicitamente e cancela nela", async () => {
    const repo = {} as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)

    await (service as any).cancelAsaasPayments(["pay_1", "pay_2"], "legacy")

    expect(createAsaasClientMock).toHaveBeenCalledWith("legacy")
    expect(requestMock).toHaveBeenCalledTimes(2)
    for (const call of requestMock.mock.calls) {
      expect(call[0]).toContain("/legacy/payments")
      expect((call[1] as RequestInit).method).toBe("DELETE")
    }
  })
})
