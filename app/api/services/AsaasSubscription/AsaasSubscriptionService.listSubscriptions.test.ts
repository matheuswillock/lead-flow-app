import { describe, expect, it, mock } from "bun:test"

// T-20.13 de [[20 — Assinaturas — Backend]] E4 (C18/C29/DA3).
const requestMock = mock(async () => {
  throw new Error("Erro na API Asaas: 500")
})
mock.module("@/lib/asaas", () => ({
  createAsaasClient: mock((accountId: string) => ({
    endpoints: { subscriptions: `https://asaas.test/${accountId}/subscriptions` },
    request: requestMock,
  })),
  asaasFetch: mock(async () => ({})),
  asaasApi: { subscriptions: "https://asaas.test/primary/subscriptions" },
}))

const { AsaasSubscriptionService } = await import("./AsaasSubscriptionService")

describe("AsaasSubscriptionService.listSubscriptions — erro propaga tipado (T-20.13)", () => {
  it("erro da API NUNCA vira [] silencioso — propaga para o caller decidir", async () => {
    await expect(
      AsaasSubscriptionService.listSubscriptions("cus_1", { limit: 5 }),
    ).rejects.toThrow("Erro na API Asaas: 500")
  })
})
