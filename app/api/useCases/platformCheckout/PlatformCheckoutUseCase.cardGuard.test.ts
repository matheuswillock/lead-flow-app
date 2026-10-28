import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { PlatformCheckoutUseCase } from "./PlatformCheckoutUseCase"
import { isMethodUnavailableOutput } from "@/lib/payment-methods/route-guard"
import { stubCardEnabledConfig } from "@/test/support/card-enabled-config"

const originalEnv = { ...process.env }

const baseInput = {
  productSlug: "email",
  purchaseType: "email_credits" as const,
  profileId: "profile-1",
  amount: 49.9,
}

function makeRepo() {
  const create = mock(async (data: Record<string, unknown>) => ({
    id: data.id,
    status: "pending",
    amount: data.amount,
    billingType: data.billingType,
    productSlug: data.productSlug,
    purchaseType: data.purchaseType,
    externalReference: data.externalReference,
    profileId: data.profileId,
  }))
  const findById = mock(async () => ({
    id: "pur-1",
    status: "pending",
    amount: 49.9,
    billingType: "PIX",
    productSlug: "email",
    purchaseType: "email_credits",
    externalReference: "ref",
    profileId: "profile-1",
  }))
  return { repo: { create, findById } as never, create, findById }
}

describe("PlatformCheckoutUseCase — cartão desligado", () => {
  let restoreConfig: () => void

  beforeEach(() => {
    restoreConfig = stubCardEnabledConfig(false)
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY
    delete process.env.CARD_PAYMENTS_ENABLED
  })
  afterEach(() => {
    restoreConfig()
    process.env = { ...originalEnv }
  })

  it("CREDIT_CARD -> erro marcado (422 na rota) e nenhuma compra criada", async () => {
    const { repo, create } = makeRepo()

    const output = await new PlatformCheckoutUseCase(repo).createCheckout({ ...baseInput, billingType: "CREDIT_CARD" })

    expect(output.isValid).toBe(false)
    expect(isMethodUnavailableOutput(output)).toBe(true)
    expect(create).not.toHaveBeenCalled()
  })

  it("CARD_PAYMENTS_ENABLED=false barra mesmo com a chave pública", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    process.env.CARD_PAYMENTS_ENABLED = "false"
    const { repo, create } = makeRepo()

    const output = await new PlatformCheckoutUseCase(repo).createCheckout({ ...baseInput, billingType: "CREDIT_CARD" })

    expect(isMethodUnavailableOutput(output)).toBe(true)
    expect(create).not.toHaveBeenCalled()
  })

  it("chave pública presente mas cartão desligado no backoffice -> barra", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    const { repo, create } = makeRepo()

    const output = await new PlatformCheckoutUseCase(repo).createCheckout({ ...baseInput, billingType: "CREDIT_CARD" })

    expect(isMethodUnavailableOutput(output)).toBe(true)
    expect(create).not.toHaveBeenCalled()
  })

  it("chave pública presente e cartão ligado no backoffice libera o cartão", async () => {
    restoreConfig()
    restoreConfig = stubCardEnabledConfig(true)
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    const { repo, create } = makeRepo()

    const output = await new PlatformCheckoutUseCase(repo).createCheckout({ ...baseInput, billingType: "CREDIT_CARD" })

    expect(output.isValid).toBe(true)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("PIX sempre passa", async () => {
    const { repo, create } = makeRepo()

    const output = await new PlatformCheckoutUseCase(repo).createCheckout({ ...baseInput, billingType: "PIX" })

    expect(output.isValid).toBe(true)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("getCheckoutDetails expõe availableBillingTypes só com PIX", async () => {
    const { repo } = makeRepo()

    const output = await new PlatformCheckoutUseCase(repo).getCheckoutDetails("pur-1")

    expect((output.result as { availableBillingTypes: string[] }).availableBillingTypes).toEqual(["PIX"])
  })
})
