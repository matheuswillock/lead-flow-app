import { describe, expect, it, mock } from "bun:test"

let lastRequestBody = ""
const requestMock = mock(async (_endpoint: string, options?: RequestInit) => {
  lastRequestBody = String(options?.body ?? "")
  return {
  id: "sub_created",
  customer: "cus_1",
  value: 239.7,
  cycle: "QUARTERLY",
  billingType: "PIX",
  status: "ACTIVE",
  nextDueDate: "2026-11-10",
  dateCreated: "2026-10-10",
  }
})

mock.module("@/lib/asaas", () => ({
  createAsaasClient: () => ({
    endpoints: { subscriptions: "https://asaas.test/subscriptions" },
    request: requestMock,
  }),
}))

const { AsaasSubscriptionService } = await import("./AsaasSubscriptionService")

describe("AsaasSubscriptionService.createManagerSubscription", () => {
  it("preserva o preço e o ciclo resolvidos pelo catálogo", async () => {
    lastRequestBody = ""
    await AsaasSubscriptionService.createManagerSubscription({
      customer: "cus_1",
      billingType: "PIX",
      value: 239.7,
      cycle: "QUARTERLY",
    })

    expect(requestMock).toHaveBeenCalledWith(
      "https://asaas.test/subscriptions",
      expect.objectContaining({
        body: expect.stringContaining('"value":239.7'),
      }),
    )
    expect(lastRequestBody).toContain('"cycle":"QUARTERLY"')
  })
})
