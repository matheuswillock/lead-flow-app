import { beforeEach, describe, expect, it, mock } from "bun:test"
import { EmailCreditPlan } from "@prisma/client"
import { buildPlatformPurchaseExternalReference } from "@/lib/billing/platform-purchase-external-reference"
import { ApplyEmailCreditsPaidPurchaseUseCase } from "./ApplyEmailCreditsPaidPurchaseUseCase"

const findByIdMock = mock(async () => null as null | {
  id: string
  teamId: string | null
  purchaseType: string
  productSlug: string
  metadata: unknown
  externalReference: string
})
const findByExternalReferenceMock = mock(async () => null)
const findByAsaasPaymentIdMock = mock(async () => null)
const applyPaidPlanMock = mock(async () => ({ applied: true, alreadyApplied: false }))

describe("ApplyEmailCreditsPaidPurchaseUseCase (T02)", () => {
  beforeEach(() => {
    findByIdMock.mockClear()
    findByExternalReferenceMock.mockClear()
    findByAsaasPaymentIdMock.mockClear()
    applyPaidPlanMock.mockClear()
    applyPaidPlanMock.mockImplementation(async () => ({ applied: true, alreadyApplied: false }))
  })

  it("T02 — webhook pago aplica créditos a partir de PlatformPurchase", async () => {
    const checkoutId = "purchase-abc"
    const externalReference = buildPlatformPurchaseExternalReference(checkoutId)
    findByIdMock.mockImplementation(async () => ({
      id: checkoutId,
      teamId: "team-1",
      purchaseType: "email_credits",
      productSlug: "email-credits-starter",
      metadata: { plan: "starter" },
      externalReference,
    }))

    const uc = new ApplyEmailCreditsPaidPurchaseUseCase(
      { applyPaidPlan: applyPaidPlanMock } as never,
      {
        findById: findByIdMock,
        findByExternalReference: findByExternalReferenceMock,
        findByAsaasPaymentId: findByAsaasPaymentIdMock,
      } as never
    )

    const result = await uc.apply({
      paymentId: "pay_123",
      externalReference,
      checkoutId,
    })

    expect(result.handled).toBe(true)
    expect(result.applied).toBe(true)
    expect(result.alreadyApplied).toBe(false)
    expect(result.teamId).toBe("team-1")
    expect(result.plan).toBe("starter")
    expect(applyPaidPlanMock).toHaveBeenCalledTimes(1)
  })

  it("T02b — pagamento duplicado é idempotente", async () => {
    const checkoutId = "purchase-dup"
    findByIdMock.mockImplementation(async () => ({
      id: checkoutId,
      teamId: "team-1",
      purchaseType: "email_credits",
      productSlug: "email-credits-plus",
      metadata: { plan: EmailCreditPlan.plus },
      externalReference: buildPlatformPurchaseExternalReference(checkoutId),
    }))
    applyPaidPlanMock.mockImplementation(async () => ({
      applied: false,
      alreadyApplied: true,
    }))

    const uc = new ApplyEmailCreditsPaidPurchaseUseCase(
      { applyPaidPlan: applyPaidPlanMock } as never,
      {
        findById: findByIdMock,
        findByExternalReference: findByExternalReferenceMock,
        findByAsaasPaymentId: findByAsaasPaymentIdMock,
      } as never
    )

    const result = await uc.apply({
      paymentId: "pay_dup",
      externalReference: buildPlatformPurchaseExternalReference(checkoutId),
      checkoutId,
    })

    expect(result.handled).toBe(true)
    expect(result.applied).toBe(false)
    expect(result.alreadyApplied).toBe(true)
  })

  it("ignora PlatformPurchase que não é email_credits", async () => {
    findByIdMock.mockImplementation(async () => ({
      id: "purchase-other",
      teamId: "team-1",
      purchaseType: "feature_addon",
      productSlug: "radar",
      metadata: null,
      externalReference: buildPlatformPurchaseExternalReference("purchase-other"),
    }))

    const uc = new ApplyEmailCreditsPaidPurchaseUseCase(
      { applyPaidPlan: applyPaidPlanMock } as never,
      {
        findById: findByIdMock,
        findByExternalReference: findByExternalReferenceMock,
        findByAsaasPaymentId: findByAsaasPaymentIdMock,
      } as never
    )

    const result = await uc.apply({
      paymentId: "pay_x",
      checkoutId: "purchase-other",
    })
    expect(result.handled).toBe(false)
    expect(applyPaidPlanMock).not.toHaveBeenCalled()
  })
})
