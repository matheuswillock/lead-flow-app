import { afterEach, describe, expect, it, mock } from "bun:test"

const fetchMock = mock(async (_url: string, _init?: RequestInit): Promise<Record<string, unknown>> => ({
  id: "cus_1",
  notificationDisabled: true,
}))

mock.module("@/lib/asaas", () => ({
  asaasApi: {
    customers: "https://sandbox.asaas.com/api/v3/customers",
    notifications: "https://sandbox.asaas.com/api/v3/notifications",
    notificationsBatch: "https://sandbox.asaas.com/api/v3/notifications/batch",
    customerNotifications: (customerId: string) =>
      `https://sandbox.asaas.com/api/v3/customers/${customerId}/notifications`,
    notificationById: (notificationId: string) =>
      `https://sandbox.asaas.com/api/v3/notifications/${notificationId}`,
  },
  asaasFetch: fetchMock,
  buildDisableCustomerFacingNotificationPatch: (notification: { id: string }) => ({
    id: notification.id,
    emailEnabledForCustomer: false,
    smsEnabledForCustomer: false,
    phoneCallEnabledForCustomer: false,
    whatsappEnabledForCustomer: false,
  }),
}))

const { AsaasCustomerService } = await import("./AsaasCustomerService")

describe("AsaasCustomerService notifications", () => {
  afterEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => ({
      id: "cus_1",
      notificationDisabled: true,
    }))
  })

  it("T03: criar customer novo envia notificationDisabled: true", async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"))
      expect(body.notificationDisabled).toBe(true)
      return {
        id: "cus_new",
        notificationDisabled: true,
      }
    })

    const result = await AsaasCustomerService.createCustomer({
      name: "Cliente Teste",
      email: "cliente@example.com",
      cpfCnpj: "12345678901",
      externalReference: "profile-1",
    })

    expect(result.success).toBe(true)
    expect(result.customerId).toBe("cus_new")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("T04: sincronizar customer existente desabilita notificações do pagador", async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    fetchMock.mockImplementation(async (url, init) => {
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({ url: String(url), body: parsedBody })

      if (String(url).endsWith("/customers/cus_1")) {
        return { id: "cus_1", notificationDisabled: true }
      }
      if (String(url).includes("/customers/cus_1/notifications")) {
        return {
          data: [
            {
              id: "not_1",
              customer: "cus_1",
              enabled: true,
              emailEnabledForCustomer: true,
              smsEnabledForCustomer: true,
            },
          ],
        }
      }
      if (String(url).endsWith("/notifications/batch")) {
        expect(parsedBody.customer).toBe("cus_1")
        expect(parsedBody.notifications[0].emailEnabledForCustomer).toBe(false)
        expect(parsedBody.notifications[0].smsEnabledForCustomer).toBe(false)
        return { data: parsedBody.notifications }
      }
      return { id: "cus_1", notificationDisabled: true }
    })

    const result = await AsaasCustomerService.disableCustomerFacingNotifications("cus_1")

    expect(result.updatedCount).toBe(1)
    expect(calls.some((call) => String(call.url).endsWith("/notifications/batch"))).toBe(true)
  })
})
