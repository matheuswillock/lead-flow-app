import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.15 de [[20 — Assinaturas — Backend]] E5 (C24).
const requestMock = mock(async (_endpoint: string, _init?: { suppressLegacy404Alert?: boolean }) => ({
  id: "pay_1",
}))
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

/**
 * Achado P2 da revisão do PR #1207 (thread PRRT_...eDvN): sem conta
 * conhecida este helper é uma SONDA (tenta primary, depois legacy) e o 404
 * é resultado esperado. Deixar o alerta `asaas-legacy-404` disparar aí
 * inunda o alarme de ponteiro morto de E7/X3 — ainda mais vindo de
 * `/api/q/payments/[id]/status`, que aceita `pay_` arbitrário sem auth.
 */
describe("supressão do alerta de ponteiro morto na sonda (achado P2 eDvN)", () => {
  beforeEach(() => {
    requestMock.mockClear()
    createAsaasClientMock.mockClear()
  })

  it("sem conta conhecida: as tentativas da sonda suprimem o alerta asaas-legacy-404", async () => {
    requestMock.mockImplementationOnce(async () => {
      throw Object.assign(new Error("not found"), { statusCode: 404 })
    })

    await getPaymentByAccountWithFallback("pay_probe")

    expect(requestMock).toHaveBeenCalledTimes(2)
    for (const call of requestMock.mock.calls) {
      expect(call[1]).toMatchObject({ suppressLegacy404Alert: true })
    }
  })

  it("controle negativo: com conta conhecida NÃO suprime — aí o 404 é o sintoma que o alerta existe para pegar", async () => {
    await getPaymentByAccountWithFallback("pay_pointer", "legacy")

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock.mock.calls[0][1]).toMatchObject({ suppressLegacy404Alert: false })
  })
})
