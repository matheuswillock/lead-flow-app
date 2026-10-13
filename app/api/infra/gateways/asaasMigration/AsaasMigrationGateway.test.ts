import { describe, expect, it, mock } from "bun:test"

const requestMock = mock(async (): Promise<{ data?: Array<Record<string, unknown>>; [key: string]: unknown }> => ({ data: [] }))

mock.module("@/lib/asaas", () => ({
  createAsaasClient: mock(() => ({
    endpoints: {
      payments: "https://api.example/v3/payments",
      subscriptions: "https://api.example/v3/subscriptions",
    },
    request: requestMock,
  })),
}))

const { AsaasMigrationGateway } = await import("./AsaasMigrationGateway")

describe("AsaasMigrationGateway reconciliação", () => {
  it("consulta pagamento primary por externalReference", async () => {
    requestMock.mockResolvedValueOnce({ data: [{ id: "pay_existing", status: "CONFIRMED", value: 79.8, customer: "cus_primary" }] })
    const gateway = new AsaasMigrationGateway()

    const payment = await gateway.findPaymentByExternalReference("asaas-migration:migration-1:initial-payment")

    expect(payment?.id).toBe("pay_existing")
    expect(requestMock).toHaveBeenCalledWith(expect.stringContaining("externalReference="), expect.objectContaining({ method: "GET" }))
  })

  it("retorna null quando não existe recurso com a referência", async () => {
    requestMock.mockResolvedValueOnce({ data: [] })
    const gateway = new AsaasMigrationGateway()

    await expect(gateway.findSubscriptionByExternalReference("missing")).resolves.toBeNull()
  })

  it("cria assinatura PIX sem enviar token de cartão", async () => {
    requestMock.mockResolvedValueOnce({
      id: "sub_pix",
      customer: "cus_primary",
      value: 59.9,
      cycle: "MONTHLY",
      nextDueDate: "2026-10-31",
      status: "ACTIVE",
    })
    const gateway = new AsaasMigrationGateway()

    await gateway.createSubscription({
      account: "primary",
      customerId: "cus_primary",
      value: 59.9,
      cycle: "MONTHLY",
      nextDueDate: "2026-10-31",
      externalReference: "asaas-migration:pix:sub_legacy",
      billingType: "PIX",
    })

    expect(requestMock).toHaveBeenCalledWith(
      "https://api.example/v3/subscriptions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          customer: "cus_primary",
          billingType: "PIX",
          value: 59.9,
          cycle: "MONTHLY",
          nextDueDate: "2026-10-31",
          externalReference: "asaas-migration:pix:sub_legacy",
        }),
      }),
    )
  })
})
