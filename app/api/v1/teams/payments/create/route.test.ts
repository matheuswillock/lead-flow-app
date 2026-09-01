import { beforeEach, describe, expect, it, mock } from "bun:test"

const teamAccessMock = mock(async () => ({
  access: {
    profileId: "profile-1",
    managerId: "manager-1",
    teamMember: { role: "manager", functions: [] },
  },
}))

mock.module("@/app/api/v1/utils/teamAccess", () => ({
  getTeamAccess: teamAccessMock,
  hasDelegatedTeamManagementAccess: () => true,
}))

const findUniqueMock = mock(async ({ where }: { where: { id: string } }) => {
  if (where.id === "profile-1") {
    return { id: "profile-1", fullName: "Requester", email: "req@example.com", functions: [] }
  }
  return {
    id: "manager-1",
    fullName: "Master",
    email: "master@example.com",
    hasPermanentSubscription: true,
    cpfCnpj: null,
    phone: null,
    postalCode: null,
    address: null,
    addressNumber: null,
    neighborhood: null,
    complement: null,
    asaasCustomerId: null,
    asaasSubscriptionId: null,
    subscriptionStatus: "active",
    subscriptionNextDueDate: null,
    subscriptionEndDate: null,
    subscriptionCycle: null,
    timezone: "America/Sao_Paulo",
  }
})
const teamCreateMock = mock(async () => ({ id: "team-1" }))
const teamMemberCreateMock = mock(async () => ({ id: "member-1" }))

mock.module("@/app/api/infra/data/prisma", () => ({
  default: {
    profile: { findUnique: findUniqueMock },
    team: { create: teamCreateMock },
    teamMember: { create: teamMemberCreateMock },
  },
}))

mock.module("@/app/api/services/billing/IncrementalBillingService", () => ({
  incrementalBillingService: {
    calculateProportionalAmount: mock(async () => ({
      billingDelta: 0,
      totalCharge: 0,
      remainingMonths: 0,
      maxInstallments: 1,
    })),
  },
}))

mock.module("@/app/api/useCases/billing/MemberProBillingUseCase", () => ({
  memberProBillingUseCase: {
    shouldBypassIncrementalCharge: mock(async () => false),
    syncUsageToSubscription: mock(async () => {}),
  },
}))

const sendAddOnConfirmedEmailMock = mock(async () => {})

mock.module("@/lib/services/EmailService", () => ({
  emailService: {
    sendAddOnConfirmedEmail: sendAddOnConfirmedEmailMock,
    sendAddOnPendingPaymentEmail: mock(async () => {}),
  },
}))

mock.module("@/lib/utils/app-url", () => ({
  getFullUrl: (path: string) => `https://app.local${path}`,
}))

const consumeBillingRateLimitMock = mock(async () => ({ allowed: true, retryAfterSeconds: 1 }))

mock.module("@/lib/billing/billing-rate-limit", () => ({
  consumeBillingRateLimit: consumeBillingRateLimitMock,
  BILLING_RATE_LIMIT_DEFAULTS: {
    webhookInvalidToken: { limit: 30, windowMs: 5 * 60_000 },
    checkoutCreate: { limit: 10, windowMs: 60_000 },
    backofficePricing: { limit: 20, windowMs: 60_000 },
  },
}))

const { POST } = await import("./route")

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/teams/payments/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-supabase-user-id": "supa-1" },
    body: JSON.stringify(body),
  })
}

import { NextRequest } from "next/server"

beforeEach(() => {
  consumeBillingRateLimitMock.mockReset()
  consumeBillingRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 })
  teamCreateMock.mockClear()
})

describe("POST /teams/payments/create — T-50.5 (S2/DA2)", () => {
  it("acima do teto → 429 com Retry-After, use case não invocado", async () => {
    consumeBillingRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 17 })

    const response = await POST(makeRequest({ name: "Novo Time" }))

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("17")
    expect(teamCreateMock).not.toHaveBeenCalled()
  })

  it("abaixo do teto → fluxo intocado (201, time criado)", async () => {
    const response = await POST(makeRequest({ name: "Novo Time" }))

    expect(response.status).toBe(201)
    expect(teamCreateMock).toHaveBeenCalled()
  })
})
