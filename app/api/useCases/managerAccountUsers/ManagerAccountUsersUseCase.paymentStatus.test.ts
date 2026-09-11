import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.16 de [[20 — Assinaturas — Backend]] E5 (C24/DA5).
//
// ManagerAccountUsersUseCase importa vários singletons no topo do módulo
// (email, supabase admin, notificações, billing) que puxam "server-only"
// transitivamente — mock completo por segurança (mock.module parcial
// contamina a suíte, agents.md), mesmo sem uso direto no teste.
const requestMock = mock(async () => ({ status: "CONFIRMED", billingType: "PIX" }))
mock.module("@/lib/asaas", () => ({
  createAsaasClient: mock((accountId: string) => ({
    endpoints: { payments: `https://asaas.test/${accountId}/payments` },
    request: requestMock,
  })),
  asaasFetch: mock(async () => ({})),
  asaasApi: { payments: "https://asaas.test/primary/payments" },
}))
mock.module("@/lib/services/EmailService", () => ({ getEmailService: () => ({}) }))
mock.module("@/lib/supabase/server", () => ({ createSupabaseAdmin: () => null }))
mock.module("@/lib/supabase/email-auth-link", () => ({ buildSetPasswordEmailAuthLink: mock(async () => "") }))
mock.module(
  "@/app/api/infra/data/repositories/managerAccountUser/ManagerAccountUserRepository",
  () => ({ managerAccountUserRepository: {} }),
)
mock.module("@/app/api/infra/data/repositories/profile/ProfileRepository", () => ({
  profileRepository: {},
}))
mock.module("@/app/api/services/notifications/NotificationService", () => ({
  notificationService: {},
}))
mock.module("@/app/api/services/billing/IncrementalBillingService", () => ({
  incrementalBillingService: {},
}))
mock.module("@/app/api/services/billing/SubscriptionCreditService", () => ({
  subscriptionCreditService: {},
}))
mock.module("@/app/api/useCases/billing/MemberProBillingUseCase", () => ({
  memberProBillingUseCase: {},
}))

const { ManagerAccountUsersUseCase } = await import("./ManagerAccountUsersUseCase")

describe("ManagerAccountUsersUseCase.getPendingPaymentStatus — 404 nao vira PENDING fixo (T-20.16)", () => {
  beforeEach(() => {
    requestMock.mockClear()
    requestMock.mockImplementation(async () => ({ status: "CONFIRMED", billingType: "PIX" }))
  })

  it("404 nas duas contas → NOT_FOUND explícito, nunca PENDING fixo", async () => {
    requestMock.mockImplementation(async () => {
      throw Object.assign(new Error("not found"), { statusCode: 404 })
    })

    const useCase = new ManagerAccountUsersUseCase({} as any)
    const result = await (useCase as any).getPendingPaymentStatus("pay_missing")

    expect(result.paymentStatus).toBe("NOT_FOUND")
    expect(result.paymentStatus).not.toBe("PENDING")
  })

  it("erro real (≠404) → UNKNOWN explícito, nunca PENDING fixo", async () => {
    requestMock.mockImplementation(async () => {
      throw Object.assign(new Error("timeout"), { statusCode: 500 })
    })

    const useCase = new ManagerAccountUsersUseCase({} as any)
    const result = await (useCase as any).getPendingPaymentStatus("pay_error")

    expect(result.paymentStatus).toBe("UNKNOWN")
    expect(result.paymentStatus).not.toBe("PENDING")
  })

  it("payment encontrado → devolve o status real do Asaas", async () => {
    const useCase = new ManagerAccountUsersUseCase({} as any)
    const result = await (useCase as any).getPendingPaymentStatus("pay_ok")

    expect(result.paymentStatus).toBe("CONFIRMED")
    expect(result.paymentMethod).toBe("PIX")
  })
})
