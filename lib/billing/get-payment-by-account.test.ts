import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.15 de [[20 — Assinaturas — Backend]] E5 (C24).
const requestMock = mock(async (_endpoint: string) => ({ id: "pay_1" }))
const createAsaasClientMock = mock((accountId: string) => ({
  endpoints: { payments: `https://asaas.test/${accountId}/payments` },
  request: requestMock,
}))
mock.module("@/lib/asaas", () => ({
  createAsaasClient: createAsaasClientMock,
  asaasFetch: mock(async () => ({})),
  asaasApi: { payments: "https://asaas.test/primary/payments" },
}))

const { getPaymentByAccountWithFallback } = await import("./get-payment-by-account")

describe("getPaymentByAccountWithFallback (T-20.15)", () => {
  beforeEach(() => {
    requestMock.mockClear()
    createAsaasClientMock.mockClear()
  })

  it("registro com conta conhecida → usa o client dessa conta direto, sem tentar outra", async () => {
    const result = await getPaymentByAccountWithFallback("pay_1", "legacy")

    expect(result).toEqual({ found: true, payment: { id: "pay_1" }, account: "legacy" })
    expect(createAsaasClientMock).toHaveBeenCalledTimes(1)
    expect(createAsaasClientMock).toHaveBeenCalledWith("legacy")
  })

  it("sem conta conhecida: 404 na primary → tenta legacy", async () => {
    requestMock.mockImplementationOnce(async () => {
      throw Object.assign(new Error("not found"), { statusCode: 404 })
    })

    const result = await getPaymentByAccountWithFallback("pay_2")

    expect(result).toEqual({ found: true, payment: { id: "pay_1" }, account: "legacy" })
    expect(createAsaasClientMock).toHaveBeenNthCalledWith(1, "primary")
    expect(createAsaasClientMock).toHaveBeenNthCalledWith(2, "legacy")
  })

  it("404 nas duas contas → found: false, explícito (nunca lança genérico)", async () => {
    requestMock.mockImplementation(async () => {
      throw Object.assign(new Error("not found"), { statusCode: 404 })
    })

    const result = await getPaymentByAccountWithFallback("pay_3")

    expect(result).toEqual({ found: false })
  })

  it("erro real (≠404) NÃO tenta a segunda conta — propaga direto", async () => {
    requestMock.mockImplementationOnce(async () => {
      throw Object.assign(new Error("timeout"), { statusCode: 500 })
    })

    await expect(getPaymentByAccountWithFallback("pay_4")).rejects.toThrow("timeout")
    expect(createAsaasClientMock).toHaveBeenCalledTimes(1)
  })
})
