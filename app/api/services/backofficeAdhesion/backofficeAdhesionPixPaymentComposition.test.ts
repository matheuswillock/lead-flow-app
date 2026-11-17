import { describe, expect, it, mock } from "bun:test"
// --isolate: o mock.module abaixo vale só para este arquivo.

const selectedByRouter = {
  provider: "ABACATE_PAY" as const,
  environment: "PRODUCTION" as const,
  externalAccountContext: "instancia-nao-padrao",
}

const createdProviders: string[] = []
const createCardPayment = mock(async () => ({ id: "card-payment-1" }))
const getStatus = mock(async () => ({ status: "CONFIRMED", amountInCents: 1000 }))

mock.module("@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition", () => ({
  resolvePaymentProviderEnvironment: () => "PRODUCTION",
  createPaymentProviderRouter: () => ({
    select: async () => selectedByRouter,
  }),
  createAbacatePayProvider: async (_environment: string, externalAccountContext: string) => {
    createdProviders.push(externalAccountContext)
    return { createCardPayment, getStatus }
  },
}))

const { createAbacateAdhesionPixGateway } = await import("./backofficeAdhesionPixPaymentComposition")

describe("createAbacateAdhesionPixGateway", () => {
  it("createCard usa a instância que o router selecionou, não uma fixa por ambiente", async () => {
    createdProviders.length = 0
    const gateway = createAbacateAdhesionPixGateway()

    await gateway.createCard({} as never)

    expect(createdProviders).toEqual(["instancia-nao-padrao"])
    expect(createCardPayment).toHaveBeenCalled()
  })

  it("getCardStatus usa a instância que o router selecionou", async () => {
    createdProviders.length = 0
    const gateway = createAbacateAdhesionPixGateway()

    await gateway.getCardStatus("external-id-1")

    expect(createdProviders).toEqual(["instancia-nao-padrao"])
    expect(getStatus).toHaveBeenCalled()
  })
})
