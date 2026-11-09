import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import type { BackofficeAdhesionBillingCycle } from "@prisma/client"
import type { BackofficeAdhesionWithRelations } from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/IBackofficeAdhesionRepository"
import { SelfCheckoutError } from "@/lib/self-checkout/contracts"
import { createEmailService } from "@/lib/email/create-email-service"

const actualTokenValidation = await import("@/lib/backoffice-adhesions/adhesion-token-validation")
mock.module("@/lib/backoffice-adhesions/adhesion-token-validation", () => ({
  ...actualTokenValidation,
  validateBackofficeAdhesionToken: async () => ({
    status: "valid",
    adhesionId: "adhesion-1",
    adhesionStatus: "pending",
    expiresAt: null,
  }),
}))

// Nunca consulta a config de pagamento no banco: o cartão é ligado/desligado pelo teste.
const actualAvailability = await import("@/lib/payment-methods/availability")
let cardEnabled = true
mock.module("@/lib/payment-methods/availability", () => ({
  ...actualAvailability,
  resolveCardAvailability: async () => ({
    card: cardEnabled,
    reason: cardEnabled ? "AVAILABLE" : "DISABLED_BY_BACKOFFICE",
    availableBillingTypes: cardEnabled ? ["PIX", "CREDIT_CARD"] : ["PIX"],
  }),
  assertBillingTypeAllowed: async () => undefined,
}))

// Cobrança no Asaas: captura o valor enviado ao provider, sem chamada real.
const asaasRequest = mock(async (_endpoint: string, _init?: RequestInit): Promise<Record<string, unknown>> => ({
  id: "pay_new",
  invoiceUrl: "https://asaas.test/i/pay_new",
}))
mock.module("@/lib/asaas", () => ({
  createAsaasClient: () => ({
    endpoints: { payments: "https://asaas.test/payments", pixQrCode: (id: string) => `https://asaas.test/${id}/pix` },
    request: asaasRequest,
  }),
  asaasFetch: mock(async () => ({ id: "cus_unused" })),
  asaasApi: { customers: "https://asaas.test/customers" },
}))

const { BackofficeAdhesionService } = await import("./BackofficeAdhesionService")
const { BackofficeCouponService } = await import("@/lib/self-checkout/coupon-service")

type Rule = {
  billingCycle: BackofficeAdhesionBillingCycle
  paymentMethod: "PIX" | "CREDIT_CARD"
  price: string
  maxInstallments?: number
  installmentSplitMode?: "EQUAL" | "CUSTOM"
  installmentSchedule?: number[]
}

const NOW = new Date("2026-11-06T12:00:00.000Z")

const request = {
  companyLegalName: "Corretora Exemplo Ltda",
  cnpj: "11222333000181",
  fullName: "Maria Souza",
  email: "maria@example.com",
  phone: "(11) 99999-9999",
  cycle: "quarterly" as const,
  termsAccepted: true as const,
}

const product = {
  id: "prod-crm",
  name: "CRM Corretor Studio",
  description: null,
  isActive: true,
  featureSlugs: ["crm"],
  priceMonthly: "100",
  priceQuarterly: "90",
  priceQuadrimester: null,
  priceSemiannual: "85",
  priceAnnual: "80",
  paymentRules: [
    { billingCycle: "quarterly", paymentMethod: "PIX", price: "89.90" },
    { billingCycle: "quarterly", paymentMethod: "CREDIT_CARD", price: "99.90", maxInstallments: 3, installmentSplitMode: "EQUAL" },
    { billingCycle: "monthly", paymentMethod: "PIX", price: "99.90" },
    { billingCycle: "semiannual", paymentMethod: "PIX", price: "80" },
    { billingCycle: "annual", paymentMethod: "PIX", price: "75" },
  ] as Rule[],
}

// Add-ons padrão: usuário R$ 19,90 e time R$ 29,90, cada um um valor ÚNICO por período contratado (não por mês);
// o time não tem preço no semestral.
const addOns: Record<string, Record<string, string | boolean | null>> = {
  "extra-user": { id: "prod-user", isActive: true, priceMonthly: "19.90", priceQuarterly: "19.90", priceQuadrimester: null, priceSemiannual: "19.90", priceAnnual: "19.90" },
  "extra-team": { id: "prod-team", isActive: true, priceMonthly: "29.90", priceQuarterly: "29.90", priceQuadrimester: null, priceSemiannual: null, priceAnnual: "29.90" },
}

type CouponRow = {
  id: string
  code: string
  discountType: "percent" | "fixed"
  discountValue: number
  isActive: boolean
  validFrom: Date | null
  validUntil: Date | null
  maxUses: number | null
  usesCount: number
}

function buildCoupon(overrides: Partial<CouponRow> = {}): CouponRow {
  return {
    id: "coupon-1",
    code: "BEMVINDO10",
    discountType: "percent",
    discountValue: 10,
    isActive: true,
    validFrom: null,
    validUntil: null,
    maxUses: null,
    usesCount: 0,
    ...overrides,
  }
}

function buildAdhesion(overrides: Record<string, unknown> = {}): BackofficeAdhesionWithRelations {
  return {
    id: "adhesion-1",
    leadId: "lead-1",
    status: "pending",
    cycle: "quarterly",
    productId: "prod-crm",
    fullName: "Maria Souza",
    phone: "11999999999",
    email: null,
    cpfCnpj: null,
    billingType: "PIX",
    asaasAccount: "primary",
    asaasPaymentId: null,
    asaasCustomerId: "cus_1",
    createdProfileId: null,
    installmentLedger: [],
    monthlyExtraTeamsAmount: "0",
    monthlyExtraUsersAmount: "0",
    extraTeams: 0,
    extraUsers: 0,
    modules: ["crm"],
    lead: { id: "lead-1", name: "Maria Souza", email: "maria@example.com", cpfCnpj: null },
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + 12 * 3600_000),
    paidAt: null,
    quoteSnapshot: null,
    quoteHash: null,
    ...overrides,
  } as unknown as BackofficeAdhesionWithRelations
}

// A validação real de cupom está desligada em produção (coupon-service.ts); aqui ela é ligada
// por injeção para provar que o desconto chega ao valor cobrado quando os cupons voltarem.
function makeHarness(coupons: CouponRow[] = [buildCoupon()], validationEnabled = true) {
  const rows = new Map(coupons.map((row) => [row.code, { ...row }]))
  const couponRepo = {
    findByCode: mock(async (code: string) => rows.get(code) ?? null),
    reserveUse: mock(async (id: string) => {
      const row = [...rows.values()].find((item) => item.id === id)
      if (!row || (row.maxUses != null && row.usesCount >= row.maxUses)) return false
      row.usesCount += 1
      return true
    }),
    releaseUse: mock(async (id: string) => {
      const row = [...rows.values()].find((item) => item.id === id)
      if (row) row.usesCount = Math.max(0, row.usesCount - 1)
    }),
  }
  const repo = {
    findProfileIdByEmail: mock(async (_email: string): Promise<string | null> => null),
    createSelfCheckoutLead: mock(async (_input: unknown) => ({ id: "lead-new" })),
    createAndMoveLeadToAdhesion: mock(async (data: Record<string, unknown>) => buildAdhesion({ ...data, id: "adhesion-1" })),
    findById: mock(async (_id: string): Promise<BackofficeAdhesionWithRelations | null> => null),
    updateCheckoutData: mock(async (_id: string, data: Record<string, unknown>) => buildAdhesion({ totalAmount: "0", ...data })),
  }
  const productRepo = {
    findDefaultByFeatureSlugWithPaymentRules: mock(async (_slug: string) => product),
    findByIdWithPaymentRules: mock(async (_id: string) => product),
    findById: mock(async (_id: string) => product),
    findDefaultByFeatureSlug: mock(async (slug: string) => addOns[slug] ?? null),
  }
  const pixPayments = {
    hasLivePendingPix: mock(async (_id: string) => false),
    createPixPayment: mock(async (_input: unknown) => ({
      id: "pay-1",
      amountCents: 0,
      providerExternalId: "pix_1",
      paymentInstructions: null,
    })),
    createCardPayment: mock(async (input: { amountCents: number }) => ({
      payment: {
        id: "pay-card",
        adhesionId: "adhesion-1",
        amountCents: input.amountCents,
        providerExternalId: "tx_card_1",
        paymentInstructions: { method: "CARD" },
        status: "pending",
      },
      providerStatus: "PENDING" as "PENDING" | "CONFIRMED",
    })),
  }
  const service = new BackofficeAdhesionService(
    repo as never,
    productRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    pixPayments as never,
    new BackofficeCouponService(couponRepo as never, { validationEnabled }),
  )
  return { service, repo, couponRepo, pixPayments, rows }
}

const payer = { fullName: "Maria Souza", email: "maria@example.com", phone: "11999999999", cpfCnpj: "52998224725" }
const cardInput = (installments: number) => ({ cardToken: "ctok_test", installments, payer })

let checkoutEmail: ReturnType<typeof spyOn>
const processEnv = process.env as Record<string, string | undefined>
let originalAbacateKey: string | undefined
beforeEach(() => {
  // Chave pública do Abacate: sem ela o cartão fica oculto (cardCheckout null).
  originalAbacateKey = processEnv.ABACATE_PAY_DEV_PUBLIC_KEY
  processEnv.ABACATE_PAY_DEV_PUBLIC_KEY = "abc_pk_test_123"
  cardEnabled = true
  asaasRequest.mockClear()
  checkoutEmail = spyOn(
    Object.getPrototypeOf(createEmailService()),
    "sendBackofficeAdhesionCheckoutEmail",
  ).mockResolvedValue(undefined as never)
})
afterEach(() => {
  checkoutEmail.mockRestore()
  if (originalAbacateKey === undefined) delete processEnv.ABACATE_PAY_DEV_PUBLIC_KEY
  else processEnv.ABACATE_PAY_DEV_PUBLIC_KEY = originalAbacateKey
})

describe("auto-checkout: opções com cartão e cupom", () => {
  it("anuncia o cartão só nos ciclos com regra de cartão e quando o cartão está ligado", async () => {
    const h = makeHarness()

    const options = await h.service.getSelfCheckoutOptions()

    expect(options.couponsEnabled).toBe(true)
    const quarterly = options.cycles.find((cycle) => cycle.cycle === "quarterly")
    expect(quarterly).toMatchObject({ pixTotal: 269.7, creditCardTotal: 299.7, creditCardMonthlyEquivalent: 99.9, maxInstallments: 3 })
    // Regra de cartão do produto tem prioridade: 99,90 x 3, e não o valor do PIX (269,70).
    expect(quarterly?.creditCardTotal).not.toBe(quarterly?.pixTotal)

    expect(options.cardCheckout).toEqual({ provider: "ABACATE_PAY", publicKey: "abc_pk_test_123" })

    cardEnabled = false
    const off = await h.service.getSelfCheckoutOptions()
    expect(off.cardCheckout).toBeNull()
    expect(off.cycles.every((cycle) => cycle.creditCardTotal === undefined)).toBe(true)
  })

  it("sem chave pública do Abacate o cartão fica oculto em tudo: opções, DTO público e pedido", async () => {
    delete processEnv.ABACATE_PAY_DEV_PUBLIC_KEY
    const h = makeHarness()

    const options = await h.service.getSelfCheckoutOptions()
    expect(options.cardCheckout).toBeNull()
    expect(options.cycles.every((cycle) => cycle.creditCardTotal === undefined && cycle.maxInstallments === undefined)).toBe(true)

    h.repo.findById.mockResolvedValue(buildAdhesion({ totalAmount: "269.70", monthlyBaseAmount: "89.90", monthlyTotalAmount: "89.90" }))
    expect(await h.service.getPublicDetails("tok")).toMatchObject({ cardPublicKey: null, availableBillingTypes: ["PIX"] })

    await expect(h.service.createSelfCheckout({ ...request, billingType: "CREDIT_CARD" })).rejects.toMatchObject({ code: "CYCLE_UNAVAILABLE" })
    await expect(h.service.createCardCheckout("tok", cardInput(1), "idem-k")).rejects.toThrow("temporariamente indisponível")
    expect(h.pixPayments.createCardPayment).not.toHaveBeenCalled()
  })
})

describe("auto-checkout: cartão sem regra de cartão no produto (mesmo valor do PIX)", () => {
  it("opções: todo ciclo vendável oferece cartão = PIX, parcelando até os meses do ciclo", async () => {
    const h = makeHarness()

    const options = await h.service.getSelfCheckoutOptions()

    const monthly = options.cycles.find((cycle) => cycle.cycle === "monthly")
    expect(monthly).toMatchObject({ pixTotal: 99.9, creditCardTotal: 99.9, creditCardMonthlyEquivalent: 99.9, maxInstallments: 1 })
    const semiannual = options.cycles.find((cycle) => cycle.cycle === "semiannual")
    expect(semiannual).toMatchObject({ pixTotal: 480, creditCardTotal: 480, creditCardMonthlyEquivalent: 80, maxInstallments: 6 })
  })

  it("pedido de cartão: total do PIX com cupom, sem ledger; /adesao oferece cartão parcelado e o Abacate cobra o valor descontado", async () => {
    const h = makeHarness()

    await h.service.createSelfCheckout({ ...request, cycle: "semiannual", billingType: "CREDIT_CARD", couponCode: "BEMVINDO10" })

    const created = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0] as Record<string, unknown>
    // Cartão e PIX saem pelo Abacate: sem ledger do Asaas, para a /adesao poder trocar de método.
    expect(created).toMatchObject({
      billingType: "CREDIT_CARD",
      cycle: "semiannual",
      totalAmount: 432,
      installmentSchedule: [432],
      installmentLedger: [],
      couponDiscountAmount: 48,
    })

    h.repo.findById.mockResolvedValue(
      buildAdhesion({ ...created, cycle: "semiannual", totalAmount: String(created.totalAmount), monthlyTotalAmount: String(created.monthlyTotalAmount) }),
    )
    const details = await h.service.getPublicDetails("tok")
    expect(details).toMatchObject({
      billingType: "CREDIT_CARD",
      availableBillingTypes: ["PIX", "CREDIT_CARD"],
      cardPublicKey: "abc_pk_test_123",
      creditCardTotalAmount: 432,
      pixTotalAmount: 432,
      maxCardInstallments: 6,
      chargeAmount: 432,
    })

    await h.service.createCardCheckout("tok", cardInput(6), "idem-semi")
    expect(h.pixPayments.createCardPayment.mock.calls[0][0]).toMatchObject({ amountCents: 43200, installments: 6, cardToken: "ctok_test" })
  })

  it("cartão mensal sem regra: uma parcela com o valor do PIX", async () => {
    const h = makeHarness()

    await h.service.createSelfCheckout({ ...request, cycle: "monthly", billingType: "CREDIT_CARD" })

    expect(h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0]).toMatchObject({ totalAmount: 99.9, installmentSchedule: [99.9] })
  })
})

describe("auto-checkout: simulação do cupom", () => {
  it("percentual: desconta do total do PIX e do cartão do ciclo", async () => {
    const h = makeHarness()

    const pix = await h.service.quoteSelfCheckoutCoupon({ couponCode: " bemvindo10 ", cycle: "quarterly" })
    const card = await h.service.quoteSelfCheckoutCoupon({ couponCode: "BEMVINDO10", cycle: "quarterly", billingType: "CREDIT_CARD" })

    expect(pix).toEqual({ code: "BEMVINDO10", label: "10% de desconto", discountAmount: 26.97, totalAfterDiscount: 242.73 })
    expect(card).toMatchObject({ discountAmount: 29.97, totalAfterDiscount: 269.73 })
  })

  it("valor fixo nunca zera a cobrança (sobra ao menos o mínimo)", async () => {
    const h = makeHarness([buildCoupon({ code: "GRANDE", discountType: "fixed", discountValue: 9999 })])

    const quote = await h.service.quoteSelfCheckoutCoupon({ couponCode: "GRANDE", cycle: "quarterly" })

    expect(quote.totalAfterDiscount).toBe(5)
  })

  it("recusa inexistente, inativo, expirado, ainda não vigente e esgotado com 422 e mensagem curta", async () => {
    const h = makeHarness([
      buildCoupon({ code: "INATIVO", isActive: false }),
      buildCoupon({ id: "c2", code: "VELHO", validUntil: new Date("2020-01-01T00:00:00Z") }),
      buildCoupon({ id: "c3", code: "FUTURO", validFrom: new Date("2099-01-01T00:00:00Z") }),
      buildCoupon({ id: "c4", code: "ESGOTADO", maxUses: 2, usesCount: 2 }),
    ])
    const messages: Record<string, string> = {
      NAOEXISTE: "Cupom inválido.",
      INATIVO: "Cupom inválido.",
      VELHO: "Cupom expirado.",
      FUTURO: "Cupom inválido.",
      ESGOTADO: "Cupom esgotado.",
    }

    for (const [couponCode, message] of Object.entries(messages)) {
      const failure = await h.service.quoteSelfCheckoutCoupon({ couponCode, cycle: "quarterly" }).catch((error) => error)
      expect(failure).toBeInstanceOf(SelfCheckoutError)
      expect(failure).toMatchObject({ code: "COUPON_INVALID", message, status: 422 })
    }
  })
})

describe("auto-checkout: o valor COBRADO leva o desconto (achado crítico)", () => {
  it("PIX Abacate: cria a adesão com o desconto e o PIX é gerado pelo valor descontado, não pelo cheio", async () => {
    const h = makeHarness()

    await h.service.createSelfCheckout({ ...request, couponCode: "bemvindo10" })

    const created = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0] as Record<string, unknown>
    expect(created).toMatchObject({
      billingType: "PIX",
      totalAmount: 242.73,
      monthlyTotalAmount: 80.91,
      installmentSchedule: [242.73],
      installmentLedger: [],
      couponId: "coupon-1",
      couponCode: "BEMVINDO10",
      couponDiscountType: "percent",
      couponDiscountValue: 10,
      couponDiscountAmount: 26.97,
    })
    expect(h.rows.get("BEMVINDO10")?.usesCount).toBe(1)

    // Releitura da adesão como o banco a devolve: a cobrança é recalculada pelas regras do produto.
    h.repo.findById.mockResolvedValue(
      buildAdhesion({
        ...created,
        monthlyBaseAmount: "90",
        totalAmount: String(created.totalAmount),
        monthlyTotalAmount: String(created.monthlyTotalAmount),
      }),
    )
    await h.service.createPixCheckout("tok", payer, "idem-1")

    const [pixInput] = (h.pixPayments.createPixPayment.mock.calls as unknown[][])[0]
    expect(pixInput).toMatchObject({ adhesionId: "adhesion-1", amountCents: 24273 })
    const snapshot = (h.repo.updateCheckoutData.mock.calls[0][1] as { quoteSnapshot: { amount: number } }).quoteSnapshot
    expect(snapshot.amount).toBe(242.73)
  })

  it("sem cupom o PIX continua cobrando o valor cheio", async () => {
    const h = makeHarness()
    await h.service.createSelfCheckout(request)
    const created = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0] as Record<string, unknown>
    h.repo.findById.mockResolvedValue(
      buildAdhesion({ ...created, totalAmount: String(created.totalAmount), monthlyTotalAmount: String(created.monthlyTotalAmount) }),
    )

    await h.service.createPixCheckout("tok", payer, "idem-2")

    expect((h.pixPayments.createPixPayment.mock.calls as unknown[][])[0][0]).toMatchObject({ amountCents: 26970 })
    expect(created).not.toHaveProperty("couponId")
  })

  it("cartão com regra de cartão: o Abacate cobra o total de cartão do produto com o desconto, em até as parcelas da regra", async () => {
    const h = makeHarness()

    await h.service.createSelfCheckout({ ...request, billingType: "CREDIT_CARD", couponCode: "BEMVINDO10" })

    const created = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0] as Record<string, unknown>
    // 299,70 (regra de cartão) - 10%
    expect(created).toMatchObject({ billingType: "CREDIT_CARD", totalAmount: 269.73, installmentLedger: [], couponDiscountAmount: 29.97 })

    h.repo.findById.mockResolvedValue(
      buildAdhesion({ ...created, totalAmount: String(created.totalAmount), monthlyTotalAmount: String(created.monthlyTotalAmount) }),
    )
    expect(await h.service.getPublicDetails("tok")).toMatchObject({
      billingType: "CREDIT_CARD",
      availableBillingTypes: ["PIX", "CREDIT_CARD"],
      creditCardTotalAmount: 269.73,
      pixTotalAmount: 242.73,
      maxCardInstallments: 3,
      chargeAmount: 269.73,
    })

    await h.service.createCardCheckout("tok", cardInput(3), "idem-card")
    expect(h.pixPayments.createCardPayment.mock.calls[0][0]).toMatchObject({ amountCents: 26973, installments: 3 })
    // Parcelamento fora do permitido pela regra (3x) é recusado sem cobrar.
    await expect(h.service.createCardCheckout("tok", cardInput(4), "idem-card-4")).rejects.toThrow("Parcelamento inválido")
    expect(h.pixPayments.createCardPayment).toHaveBeenCalledTimes(1)
  })

  it("cartão indisponível: recusa sem reservar o cupom", async () => {
    const h = makeHarness()
    cardEnabled = false
    await expect(
      h.service.createSelfCheckout({ ...request, billingType: "CREDIT_CARD", couponCode: "BEMVINDO10" }),
    ).rejects.toMatchObject({ code: "CYCLE_UNAVAILABLE" })

    expect(h.couponRepo.reserveUse).not.toHaveBeenCalled()
    expect(h.repo.createAndMoveLeadToAdhesion).not.toHaveBeenCalled()
  })
})

describe("auto-checkout: limite de usos do cupom", () => {
  it("reserva atômica: com 1 uso restante só um de dois pedidos simultâneos passa", async () => {
    const h = makeHarness([buildCoupon({ maxUses: 1 })])

    const results = await Promise.allSettled([
      h.service.createSelfCheckout({ ...request, couponCode: "BEMVINDO10" }),
      h.service.createSelfCheckout({ ...request, email: "outra@example.com", couponCode: "BEMVINDO10" }),
    ])

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult
    expect(rejected.reason).toMatchObject({ code: "COUPON_INVALID", message: "Cupom esgotado." })
    expect(h.rows.get("BEMVINDO10")?.usesCount).toBe(1)
    expect(h.repo.createAndMoveLeadToAdhesion).toHaveBeenCalledTimes(1)
  })

  it("devolve o uso quando a criação do pedido falha", async () => {
    const h = makeHarness([buildCoupon({ maxUses: 1 })])
    h.repo.createAndMoveLeadToAdhesion.mockRejectedValueOnce(new Error("db down"))

    await expect(h.service.createSelfCheckout({ ...request, couponCode: "BEMVINDO10" })).rejects.toThrow("db down")

    expect(h.rows.get("BEMVINDO10")?.usesCount).toBe(0)
    expect(h.couponRepo.releaseUse).toHaveBeenCalledTimes(1)
  })

  it("cupom inválido no pedido recusa antes de criar lead ou adesão", async () => {
    const h = makeHarness()

    await expect(h.service.createSelfCheckout({ ...request, couponCode: "NAOEXISTE" })).rejects.toMatchObject({
      code: "COUPON_INVALID",
    })

    expect(h.repo.createSelfCheckoutLead).not.toHaveBeenCalled()
    expect(h.repo.createAndMoveLeadToAdhesion).not.toHaveBeenCalled()
  })
})

describe("auto-checkout: cupons desligados (padrão atual)", () => {
  it("qualquer cupom na simulação falha como expirado, sem consultar o repositório de cupons", async () => {
    const h = makeHarness([buildCoupon()], false)

    const failure = await h.service.quoteSelfCheckoutCoupon({ couponCode: "BEMVINDO10", cycle: "quarterly" }).catch((error) => error)

    expect(failure).toBeInstanceOf(SelfCheckoutError)
    expect(failure).toMatchObject({ code: "COUPON_INVALID", message: "Cupom expirado.", status: 422 })
    expect(h.couponRepo.findByCode).not.toHaveBeenCalled()
    expect(h.couponRepo.reserveUse).not.toHaveBeenCalled()
  })

  it("cupom no pedido falha como expirado antes de criar lead ou adesão e sem tocar no repositório", async () => {
    const h = makeHarness([buildCoupon()], false)

    await expect(h.service.createSelfCheckout({ ...request, couponCode: "BEMVINDO10" })).rejects.toMatchObject({
      code: "COUPON_INVALID",
      message: "Cupom expirado.",
    })

    expect(h.couponRepo.findByCode).not.toHaveBeenCalled()
    expect(h.couponRepo.reserveUse).not.toHaveBeenCalled()
    expect(h.repo.createSelfCheckoutLead).not.toHaveBeenCalled()
    expect(h.repo.createAndMoveLeadToAdhesion).not.toHaveBeenCalled()
  })

  it("pedido sem cupom segue normal e as opções mantêm couponsEnabled", async () => {
    const h = makeHarness([], false)

    await h.service.createSelfCheckout(request)

    expect(h.repo.createAndMoveLeadToAdhesion).toHaveBeenCalledTimes(1)
    expect((await h.service.getSelfCheckoutOptions()).couponsEnabled).toBe(true)
    expect(h.couponRepo.findByCode).not.toHaveBeenCalled()
  })
})

describe("auto-checkout: usuários e times adicionais", () => {
  it("opções trazem o preço de cada adicional por ciclo (valor do período) e omitem o que o ciclo não tem", async () => {
    const h = makeHarness()

    const options = await h.service.getSelfCheckoutOptions()

    const quarterly = options.cycles.find((cycle) => cycle.cycle === "quarterly")
    expect(quarterly).toMatchObject({ extraUserMonthlyPrice: 19.9, extraTeamMonthlyPrice: 29.9 })
    const semiannual = options.cycles.find((cycle) => cycle.cycle === "semiannual")
    expect(semiannual?.extraUserMonthlyPrice).toBe(19.9)
    expect(semiannual).not.toHaveProperty("extraTeamMonthlyPrice")
  })

  it("PIX: total = plano + quantidade x preço do período; a adesão grava quantidades e o valor único dos extras, e o PIX cobra esse total", async () => {
    const h = makeHarness()

    await h.service.createSelfCheckout({ ...request, extraUsers: 2, extraTeams: 1 })

    const created = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0] as Record<string, unknown>
    // trimestral: 269,70 do plano + 2 usuários x 19,90 x 3 meses (119,40) + 1 time x 29,90 (valor único do período)
    expect(created).toMatchObject({
      extraUsers: 2,
      extraTeams: 1,
      extrasTotalAmount: 149.3,
      totalAmount: 419,
      monthlyTotalAmount: 139.67,
      installmentSchedule: [419],
      installmentLedger: [],
    })

    // Releitura como o banco devolve: o total recalculado pelas regras bate exatamente com o criado.
    h.repo.findById.mockResolvedValue(
      buildAdhesion({ ...created, totalAmount: String(created.totalAmount), monthlyTotalAmount: String(created.monthlyTotalAmount) }),
    )
    await h.service.createPixCheckout("tok", payer, "idem-extras")
    expect((h.pixPayments.createPixPayment.mock.calls as unknown[][])[0][0]).toMatchObject({ amountCents: 41900 })
  })

  it("cartão com regra de cartão: plano do cartão + extras como valor único; o Abacate cobra o total com extras", async () => {
    const h = makeHarness()

    await h.service.createSelfCheckout({ ...request, billingType: "CREDIT_CARD", extraUsers: 2, extraTeams: 1 })

    const created = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0] as Record<string, unknown>
    // 299,70 (cartão) + 149,30 (2 usuários x 19,90 x 3 meses + 1 time)
    expect(created).toMatchObject({ totalAmount: 449, installmentLedger: [], extraUsers: 2, extraTeams: 1 })

    h.repo.findById.mockResolvedValue(
      buildAdhesion({ ...created, totalAmount: String(created.totalAmount), monthlyTotalAmount: String(created.monthlyTotalAmount) }),
    )
    expect(await h.service.getPublicDetails("tok")).toMatchObject({ creditCardTotalAmount: 449, chargeAmount: 449, maxCardInstallments: 3 })
    await h.service.createCardCheckout("tok", cardInput(3), "idem-extras-card")
    expect(h.pixPayments.createCardPayment.mock.calls[0][0]).toMatchObject({ amountCents: 44900, installments: 3 })
  })

  it("DTO público do auto-checkout traz extrasTotalAmount, isSelfCheckout e companyName; o administrativo traz null/false/null", async () => {
    const h = makeHarness()
    await h.service.createSelfCheckout({ ...request, extraUsers: 2, extraTeams: 1 })
    const created = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0] as Record<string, unknown>
    h.repo.findById.mockResolvedValue(
      buildAdhesion({
        ...created,
        totalAmount: String(created.totalAmount),
        lead: { id: "lead-1", name: "Maria Souza", email: "maria@example.com", cpfCnpj: null, qualificationLeadOrganization: "  Corretora Exemplo  " },
      }),
    )

    expect(await h.service.getPublicDetails("tok")).toMatchObject({
      extrasTotalAmount: 149.3,
      isSelfCheckout: true,
      companyName: "Corretora Exemplo",
    })

    // Sem adicionais o auto-checkout continua identificado (valor 0, não null).
    await h.service.createSelfCheckout(request)
    const plain = h.repo.createAndMoveLeadToAdhesion.mock.calls[1][0] as Record<string, unknown>
    h.repo.findById.mockResolvedValue(buildAdhesion({ ...plain, totalAmount: String(plain.totalAmount) }))
    expect(await h.service.getPublicDetails("tok")).toMatchObject({ extrasTotalAmount: 0, isSelfCheckout: true, companyName: null })

    // Adesão do cadastro administrativo: extrasTotalAmount nulo.
    h.repo.findById.mockResolvedValue(buildAdhesion({ extrasTotalAmount: null, monthlyBaseAmount: "89.90", totalAmount: "269.70", monthlyTotalAmount: "89.90" }))
    expect(await h.service.getPublicDetails("tok")).toMatchObject({ extrasTotalAmount: null, isSelfCheckout: false, companyName: null })
  })

  it("anual não vende usuário adicional (usuários ilimitados): sem preço nas opções e pedido com extraUsers é recusado", async () => {
    const h = makeHarness()

    const annual = (await h.service.getSelfCheckoutOptions()).cycles.find((cycle) => cycle.cycle === "annual")
    expect(annual).not.toHaveProperty("extraUserMonthlyPrice")
    expect(annual?.extraTeamMonthlyPrice).toBe(29.9)

    const failure = await h.service.createSelfCheckout({ ...request, cycle: "annual", extraUsers: 1 }).catch((error) => error)
    expect(failure).toMatchObject({ code: "CYCLE_UNAVAILABLE", message: "Usuários adicionais não estão disponíveis para este plano." })
    expect(h.repo.createAndMoveLeadToAdhesion).not.toHaveBeenCalled()

    await h.service.createSelfCheckout({ ...request, cycle: "annual", extraUsers: 0 })
    expect(h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0]).toMatchObject({ totalAmount: 900, extrasTotalAmount: 0 })
  })

  it("anual em 12x: 29,90 por time adicional é o total do ano, sem centavos perdidos na divisão", async () => {
    const h = makeHarness()

    await h.service.createSelfCheckout({ ...request, cycle: "annual", billingType: "CREDIT_CARD", extraTeams: 1 })

    const created = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0] as Record<string, unknown>
    // plano anual 75 x 12 = 900 + 29,90
    expect(created).toMatchObject({ totalAmount: 929.9, extrasTotalAmount: 29.9, extraTeams: 1, extraUsers: 0 })

    h.repo.findById.mockResolvedValue(
      buildAdhesion({ ...created, cycle: "annual", totalAmount: String(created.totalAmount), monthlyTotalAmount: String(created.monthlyTotalAmount) }),
    )
    const details = await h.service.getPublicDetails("tok")
    expect(details).toMatchObject({ pixTotalAmount: 929.9, creditCardTotalAmount: 929.9, chargeAmount: 929.9, maxCardInstallments: 12 })
    await h.service.createCardCheckout("tok", cardInput(12), "idem-annual")
    expect(h.pixPayments.createCardPayment.mock.calls[0][0]).toMatchObject({ amountCents: 92990, installments: 12 })
  })

  it("cartão sem regra de cartão: valor do PIX com extras em até os meses do ciclo", async () => {
    const h = makeHarness()

    await h.service.createSelfCheckout({ ...request, cycle: "semiannual", billingType: "CREDIT_CARD", extraUsers: 1 })

    // 480 + 1 usuário x 19,90 x 6 meses = 599,40
    const created = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0] as Record<string, unknown>
    expect(created).toMatchObject({ totalAmount: 599.4, extraUsers: 1, extraTeams: 0, installmentLedger: [] })
  })

  it("sem extras o pedido grava 0 e 0 e o total não muda", async () => {
    const h = makeHarness()

    await h.service.createSelfCheckout(request)

    expect(h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0]).toMatchObject({ extraUsers: 0, extraTeams: 0, totalAmount: 269.7 })
  })

  it("quantidade de adicional sem preço no ciclo: erro claro e nada é criado", async () => {
    const h = makeHarness()

    const failure = await h.service
      .createSelfCheckout({ ...request, cycle: "semiannual", extraTeams: 1 })
      .catch((error) => error)

    expect(failure).toBeInstanceOf(SelfCheckoutError)
    expect(failure).toMatchObject({ code: "CYCLE_UNAVAILABLE", message: "Times adicionais não estão disponíveis para este plano." })
    expect(h.repo.createSelfCheckoutLead).not.toHaveBeenCalled()
    expect(h.repo.createAndMoveLeadToAdhesion).not.toHaveBeenCalled()
  })
})

describe("cartão transparente do Abacate na /adesao", () => {
  async function prepareCardAdhesion(h: ReturnType<typeof makeHarness>, overrides: Record<string, unknown> = {}) {
    await h.service.createSelfCheckout({ ...request, billingType: "CREDIT_CARD", couponCode: "BEMVINDO10" })
    const created = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0] as Record<string, unknown>
    const adhesion = buildAdhesion({
      ...created,
      totalAmount: String(created.totalAmount),
      monthlyTotalAmount: String(created.monthlyTotalAmount),
      ...overrides,
    })
    h.repo.findById.mockResolvedValue(adhesion)
    h.repo.updateCheckoutData.mockImplementation(async (_id: string, data: Record<string, unknown>) =>
      buildAdhesion({ ...created, totalAmount: String(created.totalAmount), monthlyTotalAmount: String(created.monthlyTotalAmount), ...data }),
    )
    return adhesion
  }

  it("aprovado na hora: ativa pelo mesmo caminho do PIX e responde como pagamento do cartão, sem dados sensíveis", async () => {
    const h = makeHarness()
    const adhesion = await prepareCardAdhesion(h)
    h.pixPayments.createCardPayment.mockResolvedValueOnce({
      payment: { id: "pay-card", adhesionId: "adhesion-1", amountCents: 26973, providerExternalId: "tx_1", paymentInstructions: { method: "CARD" }, status: "pending" },
      providerStatus: "CONFIRMED",
    })
    const markPaid = mock(async (_id: string, _input: unknown) => undefined)
    ;(h.service as unknown as { markPaidFromProvider: unknown }).markPaidFromProvider = markPaid
    h.repo.findById.mockResolvedValue({ ...adhesion, status: "paid" } as never)

    const view = await h.service.createCardCheckout("tok", cardInput(3), "idem-1")

    expect(markPaid).toHaveBeenCalledTimes(1)
    expect(markPaid.mock.calls[0]).toEqual([
      "adhesion-1",
      { paidAt: expect.any(Date), providerPaymentId: "tx_1", adhesionPaymentId: "pay-card", amountInCents: 26973 },
    ])
    expect(view).toEqual({
      adhesionId: "adhesion-1",
      paymentId: "tx_1",
      provider: "ABACATE_PAY",
      status: "paid",
      billingType: "CREDIT_CARD",
      amount: 269.73,
      invoiceUrl: null,
      bankSlipUrl: null,
    })
    // Cobra o total gravado na adesão (cupom incluído), com snapshot da cotação para a conferência do webhook.
    const snapshot = (h.repo.updateCheckoutData.mock.calls[0][1] as { quoteSnapshot: { amount: number; installments: number } }).quoteSnapshot
    expect(snapshot).toMatchObject({ amount: 269.73, installments: 3 })
  })

  it("PENDING: não ativa agora; a ativação fica com o webhook transparent.completed", async () => {
    const h = makeHarness()
    await prepareCardAdhesion(h)
    const markPaid = mock(async () => undefined)
    ;(h.service as unknown as { markPaidFromProvider: unknown }).markPaidFromProvider = markPaid

    const view = await h.service.createCardCheckout("tok", cardInput(1), "idem-2")

    expect(markPaid).not.toHaveBeenCalled()
    expect(view).toMatchObject({ status: "pending", billingType: "CREDIT_CARD", provider: "ABACATE_PAY" })
  })

  it("falha ao ativar depois da aprovação não perde a venda: não lança e deixa para o webhook/cron", async () => {
    const h = makeHarness()
    await prepareCardAdhesion(h)
    h.pixPayments.createCardPayment.mockResolvedValueOnce({
      payment: { id: "pay-card", adhesionId: "adhesion-1", amountCents: 26973, providerExternalId: "tx_1", paymentInstructions: { method: "CARD" }, status: "pending" },
      providerStatus: "CONFIRMED",
    })
    ;(h.service as unknown as { markPaidFromProvider: unknown }).markPaidFromProvider = mock(async () => {
      throw new Error("falha ao criar conta")
    })
    const original = console.error
    console.error = () => undefined
    try {
      await expect(h.service.createCardCheckout("tok", cardInput(3), "idem-3")).resolves.toMatchObject({ billingType: "CREDIT_CARD" })
    } finally {
      console.error = original
    }
  })

  it("recusa do cartão propaga a mensagem genérica e não ativa nada", async () => {
    const h = makeHarness()
    await prepareCardAdhesion(h)
    h.pixPayments.createCardPayment.mockRejectedValueOnce(new Error("Não foi possível processar o pagamento com este cartão."))

    await expect(h.service.createCardCheckout("tok", cardInput(3), "idem-4")).rejects.toThrow(
      "Não foi possível processar o pagamento com este cartão.",
    )
  })

  it("exige pagador completo e e-mail sem conta, e não aceita parcelas acima do permitido", async () => {
    const h = makeHarness()
    await prepareCardAdhesion(h)

    await expect(h.service.createCardCheckout("tok", { ...cardInput(3), payer: { ...payer, phone: "" } }, "k1")).rejects.toThrow("Telefone inválido")
    await expect(h.service.createCardCheckout("tok", cardInput(13), "k2")).rejects.toThrow("Parcelamento inválido")
    h.repo.findProfileIdByEmail.mockResolvedValueOnce("profile-1")
    await expect(h.service.createCardCheckout("tok", cardInput(3), "k3")).rejects.toThrow("Já existe uma conta")
    expect(h.pixPayments.createCardPayment).not.toHaveBeenCalled()
  })

  it("adesão com parcela pendente do Asaas não passa pelo cartão do Abacate", async () => {
    const h = makeHarness()
    await prepareCardAdhesion(h, {
      installmentLedger: [{ index: 0, amount: 100, paymentSource: "ASAAS", status: "pending", asaasPaymentId: null, paidAt: null }],
    })

    await expect(h.service.createCardCheckout("tok", cardInput(3), "k4")).rejects.toThrow("parcelas no Asaas")
  })

  it("polling com sync: cartão pendente confirmado no provider ativa a adesão; divergência de valor não ativa", async () => {
    const h = makeHarness()
    const adhesion = await prepareCardAdhesion(h)
    const row = { id: "pay-card", adhesionId: "adhesion-1", amountCents: 26973, providerExternalId: "tx_1", paymentInstructions: { method: "CARD" }, status: "pending" }
    const extra = h.pixPayments as unknown as Record<string, unknown>
    extra.findLatest = mock(async () => row)
    extra.findById = mock(async () => ({ ...row, status: "confirmed" }))
    const status = { status: "CONFIRMED", amountInCents: 26973 }
    extra.getCardProviderStatus = mock(async () => status)
    const markPaid = mock(async () => undefined)
    ;(h.service as unknown as { markPaidFromProvider: unknown }).markPaidFromProvider = markPaid
    h.repo.findById.mockResolvedValue({ ...adhesion, status: "paid" } as never)

    const view = await h.service.getPaymentStatus("tok", { sync: true })
    expect(markPaid).toHaveBeenCalledTimes(1)
    expect(view).toMatchObject({ billingType: "CREDIT_CARD", provider: "ABACATE_PAY", status: "paid" })

    markPaid.mockClear()
    status.amountInCents = 100
    await h.service.getPaymentStatus("tok", { sync: true })
    expect(markPaid).not.toHaveBeenCalled()

    // Sem sync o polling só lê o banco.
    status.amountInCents = 26973
    await h.service.getPaymentStatus("tok")
    expect(markPaid).not.toHaveBeenCalled()
  })
})
