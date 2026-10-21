import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import type { BackofficeAdhesionPayment } from "@prisma/client"
import type { BackofficeAdhesionWithRelations } from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/IBackofficeAdhesionRepository"

import { hashBillingQuote } from "@/lib/billing/billingCheckoutIntent"

const captureMessage = mock((_message: string, _options?: unknown) => "event-id")
mock.module("@sentry/nextjs", () => ({ captureMessage, captureException: mock(() => "event-id") }))

const actualTokenValidation = await import("@/lib/backoffice-adhesions/adhesion-token-validation")
let tokenValidation: { status: string; adhesionId: string | null; adhesionStatus: string | null } = {
  status: "valid",
  adhesionId: "adhesion-1",
  adhesionStatus: "pending",
}
mock.module("@/lib/backoffice-adhesions/adhesion-token-validation", () => ({
  ...actualTokenValidation,
  validateBackofficeAdhesionToken: async () => ({ ...tokenValidation, expiresAt: null }),
}))

const { BackofficeAdhesionService, PIX_PENDING_SWITCH_BLOCKED_MESSAGE } = await import("./BackofficeAdhesionService")

const NOW = new Date("2026-10-21T12:00:00.000Z")
const QUOTE = { adhesionId: "adhesion-1", billingType: "PIX", amount: 299.9, createdAt: "2026-10-21T11:59:00.000Z" } as Record<string, unknown>
const payerInput = { fullName: "Maria Souza", email: "Maria@Example.com", phone: "(11) 99999-9999", cpfCnpj: "123.456.789-09" }

function buildAdhesion(overrides: Record<string, unknown> = {}): BackofficeAdhesionWithRelations {
  return {
    id: "adhesion-1",
    status: "pending",
    cycle: "monthly",
    productId: null,
    fullName: "Maria",
    phone: "11999999999",
    email: null,
    cpfCnpj: null,
    billingType: "PIX",
    asaasAccount: "primary",
    asaasPaymentId: null,
    createdProfileId: null,
    createdSupabaseId: null,
    installmentLedger: [],
    monthlyBaseAmount: "299.90",
    monthlyTotalAmount: "299.90",
    totalAmount: "299.90",
    monthlyExtraTeamsAmount: "0",
    monthlyExtraUsersAmount: "0",
    extraTeams: 0,
    extraUsers: 0,
    modules: ["crm"],
    lead: { name: "Lead", email: null, cpfCnpj: null },
    createdAt: NOW,
    expiresAt: new Date("2026-10-22T12:00:00.000Z"),
    paidAt: null,
    quoteSnapshot: QUOTE,
    quoteHash: hashBillingQuote(QUOTE),
    ...overrides,
  } as unknown as BackofficeAdhesionWithRelations
}

function buildPayment(overrides: Partial<BackofficeAdhesionPayment> = {}): BackofficeAdhesionPayment {
  return {
    id: "pay-1",
    adhesionId: "adhesion-1",
    amountCents: 29990,
    status: "pending",
    provider: "ABACATE_PAY",
    providerEnvironment: "PRODUCTION",
    providerSessionId: "s-1",
    providerAttemptId: "a-1",
    providerExternalId: "pix_1",
    idempotencyKey: "k",
    payerName: "Maria Souza",
    payerEmail: "maria@example.com",
    payerTaxId: "12345678909",
    payerCellphone: "11999999999",
    paymentInstructions: { brCode: "000201", brCodeBase64: "AAA", expiresAt: "2026-10-21T12:30:00.000Z" },
    confirmedAt: null,
    completedAt: null,
    failureReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as BackofficeAdhesionPayment
}

function makeHarness(adhesion: BackofficeAdhesionWithRelations) {
  const state = { adhesion }
  const repo = {
    findById: mock(async () => state.adhesion),
    findProfileIdByEmail: mock(async () => null),
    updateCheckoutData: mock(async (_id: string, data: Record<string, unknown>) => {
      state.adhesion = { ...state.adhesion, ...data } as BackofficeAdhesionWithRelations
      return state.adhesion
    }),
    updateStatus: mock(async (_id: string, status: string, dates?: { paidAt?: Date }) => {
      state.adhesion = { ...state.adhesion, status, paidAt: dates?.paidAt ?? null } as BackofficeAdhesionWithRelations
      return state.adhesion
    }),
    update: mock(async () => state.adhesion),
    clearPaymentArtifacts: mock(async () => {
      state.adhesion = { ...state.adhesion, asaasPaymentId: null } as BackofficeAdhesionWithRelations
      return state.adhesion
    }),
  }
  const productRepo = {
    findDefaultByFeatureSlugWithPaymentRules: mock(async () => ({ id: "prod-1", isActive: true, paymentRules: [] })),
    findByIdWithPaymentRules: mock(async () => null),
  }
  const pixPayments = {
    createPixPayment: mock(async () => buildPayment()),
    findLatest: mock(async (): Promise<BackofficeAdhesionPayment | null> => null),
    hasLivePendingPix: mock(async () => false),
    markConfirmed: mock(async (_input: unknown) => null),
    markCompleted: mock(async (_id: string) => null),
    findById: mock(async (_id: string): Promise<BackofficeAdhesionPayment | null> => buildPayment()),
    supersedePending: mock(async (_adhesionId: string) => 0),
    markNeedsReview: mock(async (_id: string, _reason: string) => null),
  }
  const service = new BackofficeAdhesionService(
    repo as never,
    productRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    pixPayments as never,
  )
  const ensureAccount = mock(async (_adhesion: unknown) => undefined)
  ;(service as unknown as { ensureAccountForPaidAdhesion: unknown }).ensureAccountForPaidAdhesion = ensureAccount
  const cancelExisting = mock(async (current: BackofficeAdhesionWithRelations) => {
    state.adhesion = { ...current, asaasPaymentId: null } as BackofficeAdhesionWithRelations
    return state.adhesion
  })
  ;(service as unknown as { cancelExistingCheckoutPayments: unknown }).cancelExistingCheckoutPayments = cancelExisting
  return { service, repo, productRepo, pixPayments, providerPayments: pixPayments, ensureAccount, cancelExisting, state }
}

const ENV_KEYS = ["PAYMENT_PROVIDER_ENVIRONMENT", "ABACATE_PAY_PRODUCTION_PUBLIC_KEY", "ABACATE_PAY_PUBLIC_KEY", "CARD_PAYMENTS_ENABLED"] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  captureMessage.mockClear()
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
  tokenValidation = { status: "valid", adhesionId: "adhesion-1", adhesionStatus: "pending" }
})
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe("BackofficeAdhesionService.createPixCheckout (Abacate)", () => {
  it("cria o PIX com o valor PIX da adesão, grava o pagador e devolve QR/copia-e-cola", async () => {
    const h = makeHarness(buildAdhesion())

    const result = await h.service.createPixCheckout("tok", payerInput, "idem-1")

    expect(h.pixPayments.createPixPayment).toHaveBeenCalledWith({
      adhesionId: "adhesion-1",
      amountCents: 29990,
      payer: { name: "Maria Souza", email: "maria@example.com", cellphone: "11999999999", taxId: "12345678909" },
      idempotencyKey: "idem-1",
    })
    // O pagador fica na linha do pagamento; a adesão não é sobrescrita antes da confirmação.
    const checkoutData = h.repo.updateCheckoutData.mock.calls[0][1]
    expect(checkoutData).toMatchObject({ billingType: "PIX", quoteHash: expect.any(String) })
    for (const field of ["fullName", "phone", "email", "cpfCnpj"]) expect(checkoutData).not.toHaveProperty(field)
    expect(result).toMatchObject({
      provider: "ABACATE_PAY",
      billingType: "PIX",
      amount: 299.9,
      pix: { payload: "000201", encodedImage: "AAA", expirationDate: "2026-10-21T12:30:00.000Z" },
    })
    expect(h.cancelExisting).not.toHaveBeenCalled()
  })

  it("cancela a cobrança Asaas pendente da mesma adesão antes de gerar o PIX", async () => {
    const h = makeHarness(buildAdhesion({ asaasPaymentId: "pay_asaas_1" }))

    await h.service.createPixCheckout("tok", payerInput, "idem-1")

    expect(h.cancelExisting).toHaveBeenCalledTimes(1)
    const cancelOrder = h.cancelExisting.mock.invocationCallOrder[0]
    const createOrder = h.pixPayments.createPixPayment.mock.invocationCallOrder[0]
    expect(cancelOrder).toBeLessThan(createOrder)
  })

  it("adesão com parcela Asaas pendente no ledger continua no Asaas (não gera PIX Abacate)", async () => {
    const ledger = [{ index: 0, amount: 100, paymentSource: "ASAAS", status: "pending", asaasPaymentId: "pay_1", paidAt: null }]
    const h = makeHarness(buildAdhesion({ installmentLedger: ledger }))

    await expect(h.service.createPixCheckout("tok", payerInput, "idem-1")).rejects.toThrow("parcelas no Asaas")
    expect(h.pixPayments.createPixPayment).not.toHaveBeenCalled()
  })

  it("adesão com ledger só de parcelas EXTERNAL pagas fica no Abacate", async () => {
    const ledger = [{ index: 0, amount: 100, paymentSource: "EXTERNAL", status: "paid", asaasPaymentId: null, paidAt: "2026-10-01T00:00:00.000Z" }]
    const h = makeHarness(buildAdhesion({ installmentLedger: ledger }))

    // sem parcelas pendentes, o saldo do ledger é 0 e o valor mínimo recusa o PIX
    h.pixPayments.createPixPayment.mockImplementation(async () => buildPayment())
    const publicDetails = await h.service.getPublicDetails("tok")
    expect("pixProvider" in publicDetails && publicDetails.pixProvider).toBe("ABACATE_PAY")
  })

  it("recusa pagador sem CPF/CNPJ válido antes de qualquer escrita", async () => {
    const h = makeHarness(buildAdhesion())

    await expect(h.service.createPixCheckout("tok", { ...payerInput, cpfCnpj: "" }, "k")).rejects.toThrow("CPF/CNPJ inválido")
    expect(h.repo.updateCheckoutData).not.toHaveBeenCalled()
    expect(h.pixPayments.createPixPayment).not.toHaveBeenCalled()
  })

  it("devolve o erro de token em vez de lançar", async () => {
    tokenValidation = { status: "expired", adhesionId: "adhesion-1", adhesionStatus: "pending" }
    const h = makeHarness(buildAdhesion())

    expect(await h.service.createPixCheckout("tok", payerInput, "k")).toEqual({ tokenStatus: "expired" })
  })
})

describe("BackofficeAdhesionService — troca de método com PIX Abacate pendente", () => {
  it("bloqueia o checkout legado (PIX Asaas ou cartão) enquanto há PIX Abacate válido", async () => {
    const h = makeHarness(buildAdhesion())
    h.pixPayments.hasLivePendingPix.mockImplementation(async () => true)

    await expect(
      h.service.createCheckout("tok", { billingType: "PIX" } as never),
    ).rejects.toThrow(PIX_PENDING_SWITCH_BLOCKED_MESSAGE)
    expect(h.cancelExisting).not.toHaveBeenCalled()
  })

  it("cartão indisponível é recusado no checkout legado", async () => {
    const h = makeHarness(buildAdhesion())

    await expect(
      h.service.createCheckout("tok", { billingType: "CREDIT_CARD" } as never),
    ).rejects.toThrow("cartão")
  })
})

describe("BackofficeAdhesionService.getPaymentStatus (Abacate)", () => {
  it("lê a linha do provider sem consultar o Asaas (sync ignorado)", async () => {
    const h = makeHarness(buildAdhesion())
    h.pixPayments.findLatest.mockImplementation(async () => buildPayment())
    const syncAsaas = mock(async () => h.state.adhesion)
    ;(h.service as unknown as { syncPaymentStatusFromAsaas: unknown }).syncPaymentStatusFromAsaas = syncAsaas

    const result = await h.service.getPaymentStatus("tok", { sync: true })

    expect(syncAsaas).not.toHaveBeenCalled()
    expect(result).toMatchObject({ provider: "ABACATE_PAY", status: "pending", pix: { payload: "000201" } })
  })

  it("adesão paga com token já consumido ainda devolve a confirmação", async () => {
    tokenValidation = { status: "expired", adhesionId: "adhesion-1", adhesionStatus: "paid" }
    const h = makeHarness(buildAdhesion({ status: "paid" }))
    h.pixPayments.findLatest.mockImplementation(async () => buildPayment({ status: "completed" }))

    expect(await h.service.getPaymentStatus("tok")).toMatchObject({ status: "paid", provider: "ABACATE_PAY" })
  })

  it("token expirado de adesão não paga segue como erro", async () => {
    tokenValidation = { status: "expired", adhesionId: "adhesion-1", adhesionStatus: "pending" }
    const h = makeHarness(buildAdhesion())

    expect(await h.service.getPaymentStatus("tok")).toEqual({ tokenStatus: "expired" })
  })
})

describe("BackofficeAdhesionService.markPaidFromProvider", () => {
  const paidAt = new Date("2026-10-21T12:10:00.000Z")
  const settle = { paidAt, providerPaymentId: "pix_1", adhesionPaymentId: "pay-1", amountInCents: 29990 }

  it("marca a adesão como paga, cria a conta e conclui o pagamento nessa ordem", async () => {
    const h = makeHarness(buildAdhesion({ email: "maria@example.com" }))

    await h.service.markPaidFromProvider("adhesion-1", settle)

    expect(h.repo.updateStatus).toHaveBeenCalledWith("adhesion-1", "paid", { paidAt })
    expect(h.ensureAccount).toHaveBeenCalledTimes(1)
    expect(h.pixPayments.markConfirmed).toHaveBeenCalledWith({ id: "pay-1", providerExternalId: "pix_1", confirmedAt: paidAt })
    expect(h.pixPayments.markCompleted).toHaveBeenCalledWith("pay-1")
    expect(h.repo.updateStatus.mock.invocationCallOrder[0]).toBeLessThan(h.ensureAccount.mock.invocationCallOrder[0])
    expect(h.ensureAccount.mock.invocationCallOrder[0]).toBeLessThan(h.pixPayments.markCompleted.mock.invocationCallOrder[0])
  })

  it("cria a conta com os dados do pagador da cobrança confirmada, não os da adesão", async () => {
    const h = makeHarness(buildAdhesion({ email: "editado@outro.com", fullName: "Nome Editado" }))

    await h.service.markPaidFromProvider("adhesion-1", settle)

    expect(h.repo.updateCheckoutData).toHaveBeenCalledWith(
      "adhesion-1",
      expect.objectContaining({ email: "maria@example.com", fullName: "Maria Souza", cpfCnpj: "12345678909", phone: "11999999999" }),
    )
    expect((h.ensureAccount.mock.calls[0][0] as { email: string }).email).toBe("maria@example.com")
  })

  it("falha ao criar a conta deixa o pagamento confirmado (não concluído) para o cron reparar", async () => {
    const h = makeHarness(buildAdhesion({ email: "maria@example.com" }))
    h.ensureAccount.mockImplementation(async () => {
      throw new Error("Supabase Admin indisponível")
    })

    await expect(h.service.markPaidFromProvider("adhesion-1", settle)).rejects.toThrow("Supabase Admin indisponível")
    expect(h.pixPayments.markConfirmed).toHaveBeenCalled()
    expect(h.pixPayments.markCompleted).not.toHaveBeenCalled()
  })

  it("é idempotente: adesão já paga não regrava o status e a conta é garantida de novo", async () => {
    const h = makeHarness(buildAdhesion({ status: "paid", paidAt }))

    await h.service.markPaidFromProvider("adhesion-1", settle)
    await h.service.markPaidFromProvider("adhesion-1", settle)

    expect(h.repo.updateStatus).not.toHaveBeenCalled()
    expect(h.ensureAccount).toHaveBeenCalledTimes(2)
  })

  it("pagamento já concluído é no-op", async () => {
    const h = makeHarness(buildAdhesion({ status: "paid" }))
    h.pixPayments.findById.mockImplementation(async () => buildPayment({ status: "completed" }))

    await h.service.markPaidFromProvider("adhesion-1", settle)

    expect(h.ensureAccount).not.toHaveBeenCalled()
    expect(h.pixPayments.markNeedsReview).not.toHaveBeenCalled()
  })

  it("adesão inexistente falha em vez de ser ignorada", async () => {
    const h = makeHarness(buildAdhesion())
    h.repo.findById.mockImplementation(async () => null as never)

    await expect(h.service.markPaidFromProvider("x", settle)).rejects.toThrow("Adesão não encontrada")
  })

  it("(a) recusa pagamento que pertence a outra adesão", async () => {
    const h = makeHarness(buildAdhesion())
    h.pixPayments.findById.mockImplementation(async () => buildPayment({ adhesionId: "adhesion-OUTRA" }))

    await expect(h.service.markPaidFromProvider("adhesion-1", settle)).rejects.toThrow("não pertence")
    expect(h.repo.updateStatus).not.toHaveBeenCalled()
    expect(h.ensureAccount).not.toHaveBeenCalled()
  })

  it.each([
    ["(b) valor do provider diferente do cobrado", { amountInCents: 100 }, {}, "provider_amount_mismatch"],
    ["(b) provider sem valor informado", { amountInCents: null }, {}, "provider_amount_mismatch"],
    ["(c) quote com hash adulterado", {}, { quoteHash: "adulterado" }, "quote_mismatch"],
    ["(c) quote com valor diferente do pagamento", {}, { quoteSnapshot: { ...QUOTE, amount: 10 }, quoteHash: hashBillingQuote({ ...QUOTE, amount: 10 }) }, "quote_mismatch"],
    ["(c) adesão sem quote", {}, { quoteSnapshot: null, quoteHash: null }, "quote_mismatch"],
    ["(d) adesão cancelada", {}, { status: "canceled" }, "adhesion_canceled"],
  ])("%s vai para revisão manual sem pagar nem criar conta", async (_label, inputOverride, adhesionOverride, reason) => {
    const h = makeHarness(buildAdhesion(adhesionOverride))

    await h.service.markPaidFromProvider("adhesion-1", { ...settle, ...inputOverride })

    expect(h.pixPayments.markNeedsReview).toHaveBeenCalledWith("pay-1", reason)
    expect(h.repo.updateStatus).not.toHaveBeenCalled()
    expect(h.ensureAccount).not.toHaveBeenCalled()
    expect(h.pixPayments.markCompleted).not.toHaveBeenCalled()
    expect(captureMessage).toHaveBeenCalledTimes(1)
  })

  it("(e) pagamento tardio de PIX substituído vai para revisão manual", async () => {
    const h = makeHarness(buildAdhesion())
    h.pixPayments.findById.mockImplementation(async () => buildPayment({ status: "superseded" }))

    await h.service.markPaidFromProvider("adhesion-1", settle)

    expect(h.pixPayments.markNeedsReview).toHaveBeenCalledWith("pay-1", "payment_superseded")
    expect(h.ensureAccount).not.toHaveBeenCalled()
  })

  it("(e) editar a adesão substitui os PIX pendentes do provider", async () => {
    const h = makeHarness(buildAdhesion({ leadId: "lead-1", hasUnlimitedUsers: false }))
    ;(h.service as unknown as { resolvePrices: unknown }).resolvePrices = async () => ({
      baseMonthlyPrice: 299.9,
      extraTeamPrice: 50,
      extraUserPrice: 30,
    })
    h.productRepo.findDefaultByFeatureSlugWithPaymentRules.mockImplementation(
      async () => ({ id: "prod-1", isActive: true, paymentRules: [] }) as never,
    )

    await h.service.update("adhesion-1", { fullName: "Novo Nome", extraUsers: 2 })

    expect(h.pixPayments.supersedePending).toHaveBeenCalledWith("adhesion-1")
  })
})

describe("BackofficeAdhesionService — cartão e preset", () => {
  it("getPublicDetails: cartão indisponível some e EXTERNAL/null viram PIX (nunca cartão)", async () => {
    for (const billingType of ["CREDIT_CARD", "EXTERNAL", null]) {
      const h = makeHarness(buildAdhesion({ billingType }))
      const details = await h.service.getPublicDetails("tok")
      expect(details).toMatchObject({ availableBillingTypes: ["PIX"], pixProvider: "ABACATE_PAY" })
      expect((details as { billingType: string | null }).billingType).not.toBe("CREDIT_CARD")
    }
  })

  it("getPublicDetails: com cartão disponível mantém o preset de cartão e oferece os dois métodos", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    const h = makeHarness(buildAdhesion({ billingType: "CREDIT_CARD" }))

    const details = await h.service.getPublicDetails("tok")

    expect(details).toMatchObject({ availableBillingTypes: ["PIX", "CREDIT_CARD"], billingType: "CREDIT_CARD" })
  })

  it("create recusa nova adesão no cartão enquanto indisponível", async () => {
    const h = makeHarness(buildAdhesion())

    await expect(
      h.service.create({ leadId: "l", fullName: "Maria Souza", cycle: "monthly", extraTeams: 0, extraUsers: 0, billingType: "CREDIT_CARD" }, null),
    ).rejects.toThrow("cartão")
  })

  it("update permite manter cartão em adesão que já era cartão, mas barra a nova escolha", async () => {
    const h = makeHarness(buildAdhesion({ billingType: "PIX", leadId: "lead-1", extraTeams: 0, extraUsers: 0, hasUnlimitedUsers: false }))
    await expect(h.service.update("adhesion-1", { billingType: "CREDIT_CARD" })).rejects.toThrow("cartão")
  })
})
