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
type AsaasResponse = Record<string, unknown>

const requestMock = mock(
  async (_endpoint: string, _init?: RequestInit): Promise<AsaasResponse> => ({
    id: "pay_new",
    invoiceUrl: "https://sandbox.asaas.com/i/pay_new",
  })
)
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

  // T-40.17 (E5/C21) + T-30.26 (E8/DA5/C31): o DELETE não pode engolir erro
  // nenhum. Um 404 só é aceitável quando a PRÓPRIA conta confirma que a
  // cobrança existe ali e já está removida (`deleted: true` no
  // `GET /payments/{id}`). 404 sem essa confirmação significa "a cobrança
  // não está nesta conta" — num mundo multi-conta ela provavelmente vive na
  // outra e segue pagável: dupla cobrança, o risco que o DA5 manda bloquear.
  it("T-40.17/T-30.26: 404 no DELETE + conta confirma deleted:true → segue sem lançar", async () => {
    const repo = {} as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)
    requestMock.mockImplementation(async (_endpoint: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        const error = new Error("not found")
        ;(error as { statusCode?: number }).statusCode = 404
        throw error
      }
      return { id: "pay_ja_cancelado", deleted: true, status: "PENDING" }
    })

    await expect(
      (service as any).cancelAsaasPayments(["pay_ja_cancelado"], "legacy")
    ).resolves.toBeUndefined()
  })

  it("T-30.26: 404 no DELETE + cobrança inexistente nesta conta → bloqueia com mensagem operacional", async () => {
    const repo = {} as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)
    requestMock.mockImplementation(async () => {
      const error = new Error("not found")
      ;(error as { statusCode?: number }).statusCode = 404
      throw error
    })

    let caught: Error | null = null
    try {
      await (service as any).cancelAsaasPayments(["pay_legado"], "legacy")
    } catch (error) {
      caught = error as Error
    }

    expect(caught).not.toBeNull()
    expect(caught?.message).toMatch(/Falha ao cancelar/)
    expect(caught?.message).toContain("pay_legado")
    expect(caught?.message).toMatch(/painel Asaas/)
  })

  it("T-30.26: 404 no DELETE + cobrança ainda viva na conta → bloqueia (segue pagável)", async () => {
    const repo = {} as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)
    requestMock.mockImplementation(async (_endpoint: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        const error = new Error("not found")
        ;(error as { statusCode?: number }).statusCode = 404
        throw error
      }
      return { id: "pay_viva", deleted: false, status: "PENDING" }
    })

    await expect(
      (service as any).cancelAsaasPayments(["pay_viva"], "legacy")
    ).rejects.toThrow(/Falha ao cancelar/)
  })

  it("T-30.26: 404 numa adesão legacy não toca a conta primary", async () => {
    const repo = {} as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)
    requestMock.mockImplementation(async () => {
      const error = new Error("not found")
      ;(error as { statusCode?: number }).statusCode = 404
      throw error
    })

    await expect(
      (service as any).cancelAsaasPayments(["pay_legado"], "legacy")
    ).rejects.toThrow(/Falha ao cancelar/)

    expect(createAsaasClientMock).not.toHaveBeenCalledWith("primary")
    for (const call of requestMock.mock.calls) {
      expect(call[0]).toContain("/legacy/payments")
    }
  })

  it("T-30.26: lote misto → cancela o que existe e ainda assim falha citando só o id não confirmado", async () => {
    const repo = {} as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)
    requestMock.mockImplementation(async (endpoint: string, init?: RequestInit) => {
      if (endpoint.endsWith("/pay_ok") && init?.method === "DELETE") {
        return { id: "pay_ok", deleted: true }
      }
      const error = new Error("not found")
      ;(error as { statusCode?: number }).statusCode = 404
      throw error
    })

    let caught: Error | null = null
    try {
      await (service as any).cancelAsaasPayments(["pay_ok", "pay_sumido"], "legacy")
    } catch (error) {
      caught = error as Error
    }

    expect(caught?.message).toContain("pay_sumido")
    expect(caught?.message).not.toContain("pay_ok")
    expect(
      requestMock.mock.calls.some(
        (call) =>
          String(call[0]).endsWith("/pay_ok") &&
          (call[1] as RequestInit | undefined)?.method === "DELETE"
      )
    ).toBe(true)
  })

  it("T-40.17: erro != 404 propaga (não engole)", async () => {
    const repo = {} as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)
    requestMock.mockImplementation(async () => {
      const error = new Error("Internal error")
      ;(error as { statusCode?: number }).statusCode = 500
      throw error
    })

    await expect(
      (service as any).cancelAsaasPayments(["pay_com_erro_real"], "legacy")
    ).rejects.toThrow(/Falha ao cancelar/)
  })
})
