import { describe, expect, it } from "bun:test"
import type { PlatformPurchase } from "@prisma/client"
import { PlatformCheckoutUseCase } from "./PlatformCheckoutUseCase"
import type {
  CreatePlatformPurchaseInput,
  IPlatformPurchaseRepository,
  UpdatePlatformPurchaseInput,
} from "@/app/api/infra/data/repositories/platformPurchase/IPlatformPurchaseRepository"
import { buildPlatformPurchaseExternalReference } from "@/lib/billing/platform-purchase-external-reference"

function makePurchase(
  overrides: Partial<PlatformPurchase> & Pick<PlatformPurchase, "id" | "externalReference">
): PlatformPurchase {
  return {
    profileId: "profile-1",
    teamId: "team-1",
    productSlug: "email",
    purchaseType: "email_credits",
    status: "pending",
    billingType: "PIX",
    amount: 49.9 as unknown as PlatformPurchase["amount"],
    quantity: 1,
    description: "Créditos de e-mail",
    metadata: null,
    asaasPaymentId: null,
    asaasAccount: "primary",
    asaasCustomerId: null,
    paidAt: null,
    appliedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

class FakePlatformPurchaseRepository implements IPlatformPurchaseRepository {
  items = new Map<string, PlatformPurchase>()
  createCalls = 0
  markPaidCalls = 0

  async create(data: CreatePlatformPurchaseInput): Promise<PlatformPurchase> {
    this.createCalls += 1
    const row = makePurchase({
      id: data.id,
      profileId: data.profileId,
      teamId: data.teamId ?? null,
      productSlug: data.productSlug,
      purchaseType: data.purchaseType,
      status: data.status ?? "pending",
      billingType: data.billingType ?? null,
      amount: data.amount as unknown as PlatformPurchase["amount"],
      quantity: data.quantity ?? null,
      description: data.description ?? null,
      metadata: (data.metadata as PlatformPurchase["metadata"]) ?? null,
      asaasPaymentId: data.asaasPaymentId ?? null,
      asaasCustomerId: data.asaasCustomerId ?? null,
      externalReference: data.externalReference,
    })
    this.items.set(row.id, row)
    return row
  }

  async findById(id: string) {
    return this.items.get(id) ?? null
  }

  async findByExternalReference(externalReference: string) {
    return [...this.items.values()].find((item) => item.externalReference === externalReference) ?? null
  }

  async findByAsaasPaymentId(asaasPaymentId: string, account: string) {
    return (
      [...this.items.values()].find(
        (item) => item.asaasPaymentId === asaasPaymentId && item.asaasAccount === account
      ) ?? null
    )
  }

  async update(id: string, data: UpdatePlatformPurchaseInput) {
    const current = this.items.get(id)
    if (!current) throw new Error("not found")
    const next = { ...current, ...data } as PlatformPurchase
    this.items.set(id, next)
    return next
  }

  async markPaidOnce(input: { id: string; asaasPaymentId: string; account: string; paidAt?: Date }) {
    this.markPaidCalls += 1
    const current = this.items.get(input.id)
    if (!current || current.status === "paid") return null
    const next = makePurchase({
      ...current,
      status: "paid",
      asaasPaymentId: input.asaasPaymentId,
      asaasAccount: input.account as PlatformPurchase["asaasAccount"],
      paidAt: input.paidAt ?? new Date(),
      appliedAt: input.paidAt ?? new Date(),
    })
    this.items.set(input.id, next)
    return next
  }
}

describe("PlatformCheckoutUseCase", () => {
  it("T01: cria checkout genérico persistindo compra pendente e retorna checkoutId", async () => {
    const repo = new FakePlatformPurchaseRepository()
    const useCase = new PlatformCheckoutUseCase(repo)

    const output = await useCase.createCheckout({
      productSlug: "email",
      purchaseType: "email_credits",
      profileId: "profile-1",
      teamId: "team-1",
      billingType: "PIX",
      amount: 49.9,
      quantity: 1000,
    })

    expect(output.isValid).toBe(true)
    const details = output.result as { checkoutId: string; externalReference: string; status: string }
    expect(details.checkoutId).toBeTruthy()
    expect(details.status).toBe("pending")
    expect(details.externalReference).toBe(
      buildPlatformPurchaseExternalReference(details.checkoutId)
    )
    expect(repo.createCalls).toBe(1)
    expect(repo.items.size).toBe(1)
  })

  it("T02: reabrir checkout existente retorna detalhes sem duplicar cobrança", async () => {
    const repo = new FakePlatformPurchaseRepository()
    const useCase = new PlatformCheckoutUseCase(repo)
    const created = await useCase.createCheckout({
      productSlug: "email",
      purchaseType: "email_credits",
      profileId: "profile-1",
      billingType: "PIX",
      amount: 49.9,
    })
    const checkoutId = (created.result as { checkoutId: string }).checkoutId

    const reopened = await useCase.getCheckoutDetails(checkoutId)

    expect(reopened.isValid).toBe(true)
    expect((reopened.result as { checkoutId: string }).checkoutId).toBe(checkoutId)
    expect(repo.createCalls).toBe(1)
    expect(repo.items.size).toBe(1)
  })

  it("T05: webhook pago duplicado aplica compra uma única vez", async () => {
    const repo = new FakePlatformPurchaseRepository()
    const useCase = new PlatformCheckoutUseCase(repo)
    const created = await useCase.createCheckout({
      productSlug: "email",
      purchaseType: "email_credits",
      profileId: "profile-1",
      billingType: "PIX",
      amount: 49.9,
    })
    const details = created.result as { checkoutId: string; externalReference: string }

    const first = await useCase.applyPaidPurchase({
      externalReference: details.externalReference,
      asaasPaymentId: "pay_123",
      account: "primary",
    })
    const second = await useCase.applyPaidPurchase({
      externalReference: details.externalReference,
      asaasPaymentId: "pay_123",
      account: "primary",
    })

    expect(first.isValid).toBe(true)
    expect(first.successMessages.join(" ")).toMatch(/aplicada|sucesso/i)
    expect(second.isValid).toBe(true)
    expect(second.successMessages.join(" ")).toMatch(/já aplicada/i)
    expect(repo.markPaidCalls).toBe(1)
    expect(repo.items.get(details.checkoutId)?.status).toBe("paid")
  })

  it("T-40.E4d: asaasPaymentId colidindo entre contas não aplica a compra da conta errada (C33)", async () => {
    const repo = new FakePlatformPurchaseRepository()
    const useCase = new PlatformCheckoutUseCase(repo)

    const legacyPurchase = await useCase.createCheckout({
      productSlug: "email",
      purchaseType: "email_credits",
      profileId: "profile-legacy",
      billingType: "PIX",
      amount: 49.9,
    })
    const legacyDetails = legacyPurchase.result as { checkoutId: string; externalReference: string }
    // Simula um pagamento legacy já vinculado a este pay_ (fora do fluxo de
    // criação, como um dado migrado ou uma colisão real).
    repo.items.set(legacyDetails.checkoutId, {
      ...repo.items.get(legacyDetails.checkoutId)!,
      asaasPaymentId: "pay_colidindo",
      asaasAccount: "legacy",
    })

    const primaryPurchase = await useCase.createCheckout({
      productSlug: "email",
      purchaseType: "email_credits",
      profileId: "profile-primary",
      billingType: "PIX",
      amount: 49.9,
    })
    const primaryDetails = primaryPurchase.result as { checkoutId: string; externalReference: string }

    // O evento é da conta primary, com o MESMO asaasPaymentId da legacy —
    // só a compra da primary (via externalReference) pode ser marcada paga.
    const result = await useCase.applyPaidPurchase({
      externalReference: primaryDetails.externalReference,
      asaasPaymentId: "pay_colidindo",
      account: "primary",
    })

    expect(result.isValid).toBe(true)
    expect(repo.items.get(primaryDetails.checkoutId)?.status).toBe("paid")
    // a compra legacy MUST permanecer intocada
    expect(repo.items.get(legacyDetails.checkoutId)?.status).toBe("pending")
  })
})
