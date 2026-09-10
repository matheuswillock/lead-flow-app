import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-40.31/T-40.32 de [[40 — Checkout, Adesões e Add-ons — Backend]] (E9/C25):
// ProfileAsaasCustomerSyncUseCase migra para createAsaasClient — GET/PUT
// roteiam pela conta do profile e nunca recriam customer em catch.

const findAsaasSyncProfileByIdMock = mock(async (_id: string) => baseProfile)
const updateAsaasCustomerIdMock = mock(async () => {})

mock.module("@/app/api/infra/data/repositories/profile/ProfileRepository", () => ({
  profileRepository: {
    findAsaasSyncProfileById: findAsaasSyncProfileByIdMock,
    updateAsaasCustomerId: updateAsaasCustomerIdMock,
  },
}))

const createCustomerMock = mock(async (_input: unknown) => ({
  success: true,
  customerId: "cus_new_primary",
  data: {},
}))

mock.module("@/app/api/services/AsaasCustomer/AsaasCustomerService", () => ({
  AsaasCustomerService: { createCustomer: createCustomerMock },
}))

const requestLog: Array<{ account: string; url: string; method?: string }> = []
const requestImplByAccount: Record<string, (url: string, method?: string) => Promise<any>> = {}

function endpointsFor(accountId: string) {
  return {
    customers: `https://sandbox.asaas.com/api/v3/customers?account=${accountId}`,
    customerNotifications: (customerId: string) =>
      `https://sandbox.asaas.com/api/v3/customers/${customerId}/notifications?account=${accountId}`,
    notificationsBatch: `https://sandbox.asaas.com/api/v3/notifications/batch?account=${accountId}`,
  }
}

mock.module("@/lib/asaas", () => ({
  createAsaasClient: (accountId: "primary" | "legacy") => ({
    endpoints: endpointsFor(accountId),
    request: async (url: string, init?: RequestInit) => {
      requestLog.push({ account: accountId, url, method: init?.method })
      const impl = requestImplByAccount[accountId]
      if (!impl) throw new Error(`sem mock de request configurado para a conta ${accountId}`)
      return impl(url, init?.method)
    },
  }),
  buildDisableCustomerFacingNotificationPatch: (n: { id: string }) => ({
    id: n.id,
    emailEnabledForCustomer: false,
    smsEnabledForCustomer: false,
    phoneCallEnabledForCustomer: false,
    whatsappEnabledForCustomer: false,
  }),
}))

const { ProfileAsaasCustomerSyncUseCase } = await import("./ProfileAsaasCustomerSyncUseCase")

function statusError(statusCode: number, message = "erro"): Error {
  const error = new Error(message)
  ;(error as { statusCode?: number }).statusCode = statusCode
  return error
}

const baseProfile = {
  id: "profile-1",
  fullName: "Cliente Teste",
  email: "cliente@example.test",
  cpfCnpj: "12345678901",
  phone: null,
  postalCode: null,
  address: null,
  addressNumber: null,
  neighborhood: null,
  complement: null,
  asaasCustomerId: "cus_legacy_1" as string | null,
  asaasCustomerAccount: "legacy" as const,
}

describe("ProfileAsaasCustomerSyncUseCase — migra para o gateway (E9/C25)", () => {
  beforeEach(() => {
    requestLog.length = 0
    findAsaasSyncProfileByIdMock.mockClear()
    findAsaasSyncProfileByIdMock.mockImplementation(async () => ({ ...baseProfile }))
    updateAsaasCustomerIdMock.mockClear()
    createCustomerMock.mockClear()
    requestImplByAccount.legacy = async (_url, method) => {
      if (method === "GET" && _url.includes("/notifications?")) return { data: [] }
      return {}
    }
    requestImplByAccount.primary = async (_url, method) => {
      if (method === "GET" && _url.includes("/notifications?")) return { data: [] }
      return {}
    }
  })

  it("T-40.31: customer legacy + 404 → não recria, não sobrescreve ponteiro; erro instrui runbook", async () => {
    requestImplByAccount.legacy = async () => {
      throw statusError(404)
    }

    const useCase = new ProfileAsaasCustomerSyncUseCase()
    const output = await useCase.ensureProfileAsaasCustomer("profile-1")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toMatch(/runbook/i)
    expect(createCustomerMock).not.toHaveBeenCalled()
    expect(updateAsaasCustomerIdMock).not.toHaveBeenCalled()
    expect(requestLog.every((call) => call.account === "legacy")).toBe(true)
  })

  it("T-40.32: criação legítima (sem customer) passa pelo gateway", async () => {
    findAsaasSyncProfileByIdMock.mockImplementation(async () => ({
      ...baseProfile,
      asaasCustomerId: null,
    }))

    const useCase = new ProfileAsaasCustomerSyncUseCase()
    const output = await useCase.ensureProfileAsaasCustomer("profile-1")

    expect(output.isValid).toBe(true)
    expect(createCustomerMock).toHaveBeenCalledTimes(1)
    expect(updateAsaasCustomerIdMock).toHaveBeenCalledWith("profile-1", "cus_new_primary")
    // nenhum POST /customers direto fora do gateway
    expect(requestLog.some((call) => call.url.includes("/customers?") && call.method === "POST")).toBe(
      false
    )
  })

  it("GET/PUT de customer existente roteiam pela conta do profile (legacy)", async () => {
    const useCase = new ProfileAsaasCustomerSyncUseCase()
    const output = await useCase.ensureProfileAsaasCustomer("profile-1")

    expect(output.isValid).toBe(true)
    const customerCalls = requestLog.filter((call) => call.url.includes("/customers?"))
    expect(customerCalls.length).toBeGreaterThan(0)
    expect(customerCalls.every((call) => call.account === "legacy")).toBe(true)
  })
})
