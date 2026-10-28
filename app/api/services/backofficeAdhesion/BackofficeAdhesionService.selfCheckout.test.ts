import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import type { BackofficeAdhesionBillingCycle } from "@prisma/client"
import type { BackofficeAdhesionWithRelations } from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/IBackofficeAdhesionRepository"
import { hashBackofficeAdhesionToken } from "@/lib/backoffice-adhesions/adhesion-token-validation"
import { SelfCheckoutError } from "@/lib/self-checkout/contracts"
import { createEmailService } from "@/lib/email/create-email-service"
import { resolvePixProvider } from "./backofficeAdhesionPixHelpers"

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

const { BackofficeAdhesionService } = await import("./BackofficeAdhesionService")

type Rule = { billingCycle: BackofficeAdhesionBillingCycle; paymentMethod: "PIX" | "CREDIT_CARD"; price: string }

const NOW = new Date("2026-10-27T12:00:00.000Z")
const DAY_MS = 24 * 60 * 60 * 1000

const request = {
  fullName: "Maria Souza",
  email: "maria@example.com",
  phone: "(11) 99999-9999",
  cycle: "quarterly" as const,
}

function pixRule(billingCycle: BackofficeAdhesionBillingCycle, price: string): Rule {
  return { billingCycle, paymentMethod: "PIX", price }
}

function buildCrmProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod-crm",
    name: "CRM Corretor Studio",
    description: "Tudo para o corretor vender mais",
    isActive: true,
    featureSlugs: ["crm"],
    priceMonthly: "100",
    priceQuarterly: "90",
    priceQuadrimester: null,
    priceSemiannual: "85",
    priceAnnual: "80",
    paymentRules: [
      pixRule("annual", "75"),
      pixRule("monthly", "99.90"),
      pixRule("quarterly", "89.90"),
      pixRule("semiannual", "80"),
      { billingCycle: "monthly", paymentMethod: "CREDIT_CARD", price: "109.90" },
    ] as Rule[],
    ...overrides,
  }
}

const ADD_ON = { id: "prod-addon", isActive: true, priceMonthly: "10", priceQuarterly: "30", priceQuadrimester: "40", priceSemiannual: "60", priceAnnual: "120" }

function buildLead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    name: "Maria Souza",
    email: "maria@example.com",
    phone: "11999999999",
    cpfCnpj: null,
    status: "new_opportunity",
    sdrBackofficeUserId: null,
    closerBackofficeUserId: null,
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
    createdProfileId: null,
    createdSupabaseId: null,
    createdByBackofficeUserId: null,
    installmentLedger: [],
    monthlyBaseAmount: "89.90",
    monthlyTotalAmount: "89.90",
    totalAmount: "269.70",
    monthlyExtraTeamsAmount: "0",
    monthlyExtraUsersAmount: "0",
    extraTeams: 0,
    extraUsers: 0,
    modules: ["crm"],
    lead: buildLead(),
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + DAY_MS / 2),
    paidAt: null,
    quoteSnapshot: null,
    quoteHash: null,
    ...overrides,
  } as unknown as BackofficeAdhesionWithRelations
}

type CreatedInput = Record<string, unknown>

function makeHarness(options: { product?: ReturnType<typeof buildCrmProduct> | null } = {}) {
  const state = { product: options.product === undefined ? buildCrmProduct() : options.product }
  const repo = {
    findProfileIdByEmail: mock(async (_email: string): Promise<string | null> => null),
    createSelfCheckoutLead: mock(async (_input: unknown) => buildLead({ id: "lead-new" })),
    findByLeadId: mock(async (_leadId: string): Promise<BackofficeAdhesionWithRelations | null> => null),
    createAndMoveLeadToAdhesion: mock(async (data: CreatedInput) =>
      buildAdhesion({ ...data, id: "adhesion-new", leadId: data.leadId, monthlyBaseAmount: String(data.monthlyBaseAmount), totalAmount: String(data.totalAmount) })
    ),
    update: mock(async (_id: string, data: CreatedInput) => buildAdhesion({ ...data })),
    getOptions: mock(async () => ({ leads: [buildLead({ id: "lead-op", email: "op@example.com" })], users: [], sponsorOptions: [] })),
    findById: mock(async (_id: string): Promise<BackofficeAdhesionWithRelations | null> => null),
    updateCheckoutData: mock(async (_id: string, data: CreatedInput) => buildAdhesion({ ...data })),
  }
  const productRepo = {
    findDefaultByFeatureSlugWithPaymentRules: mock(async (_slug: string) => state.product),
    findDefaultByFeatureSlug: mock(async (_slug: string) => ADD_ON),
    findById: mock(async (_id: string) => state.product),
    findByIdWithPaymentRules: mock(async (_id: string) => state.product),
  }
  const pixPayments = {
    supersedePending: mock(async (_adhesionId: string) => 1),
    hasLivePendingPix: mock(async (_adhesionId: string) => false),
    createPixPayment: mock(async () => ({ id: "pay-1" })),
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
  return { service, repo, productRepo, pixPayments, state }
}

let checkoutEmail: ReturnType<typeof spyOn>
const env = process.env as Record<string, string | undefined>
let originalAppUrl: string | undefined

beforeEach(() => {
  // A CI não carrega .env: create() monta a URL do checkout com getFullUrl.
  originalAppUrl = env.NEXT_PUBLIC_APP_URL
  env.NEXT_PUBLIC_APP_URL = "https://app.example.com"
  tokenValidation = { status: "valid", adhesionId: "adhesion-1", adhesionStatus: "pending" }
  checkoutEmail = spyOn(
    Object.getPrototypeOf(createEmailService()),
    "sendBackofficeAdhesionCheckoutEmail",
  ).mockResolvedValue(undefined as never)
})
afterEach(() => {
  checkoutEmail.mockRestore()
  if (originalAppUrl === undefined) delete env.NEXT_PUBLIC_APP_URL
  else env.NEXT_PUBLIC_APP_URL = originalAppUrl
})

describe("BackofficeAdhesionService.getSelfCheckoutOptions", () => {
  it("lista só os ciclos com regra PIX, do menor para o maior, com total à vista e equivalente mensal", async () => {
    const h = makeHarness()

    const options = await h.service.getSelfCheckoutOptions()

    expect(options.product).toEqual({ name: "CRM Corretor Studio", description: "Tudo para o corretor vender mais" })
    expect(options.cycles.map((cycle) => cycle.cycle)).toEqual(["monthly", "quarterly", "semiannual", "annual"])
    expect(options.cycles[1]).toEqual({
      cycle: "quarterly",
      label: "Trimestral",
      months: 3,
      pixTotal: 269.7,
      monthlyEquivalent: 89.9,
    })
    expect(options.cycles[3]).toMatchObject({ cycle: "annual", label: "Anual", months: 12, pixTotal: 900, monthlyEquivalent: 75 })
  })

  it("reflete no próximo pedido ciclo removido, preço, nome e descrição novos (nada fixo no código)", async () => {
    const h = makeHarness()
    const before = await h.service.getSelfCheckoutOptions()
    expect(before.cycles.map((cycle) => cycle.cycle)).toContain("semiannual")

    h.state.product = buildCrmProduct({
      name: "CRM Pro",
      description: null,
      paymentRules: [pixRule("monthly", "120"), pixRule("annual", "70")],
    })
    const after = await h.service.getSelfCheckoutOptions()

    expect(after.product).toEqual({ name: "CRM Pro", description: null })
    expect(after.cycles.map((cycle) => cycle.cycle)).toEqual(["monthly", "annual"])
    expect(after.cycles[0].pixTotal).toBe(120)
    expect(after.cycles[1].pixTotal).toBe(840)
  })

  it("não anuncia ciclo que só tem cartão, nem ciclo que o produto não precifica", async () => {
    const h = makeHarness({
      product: buildCrmProduct({
        priceAnnual: null,
        paymentRules: [pixRule("annual", "75"), { billingCycle: "quarterly", paymentMethod: "CREDIT_CARD", price: "90" }, pixRule("monthly", "99.9")],
      }),
    })

    const options = await h.service.getSelfCheckoutOptions()

    expect(options.cycles.map((cycle) => cycle.cycle)).toEqual(["monthly"])
  })

  it("devolve cycles vazio sem produto padrão ativo ou sem nenhuma regra PIX", async () => {
    const noProduct = makeHarness({ product: null })
    expect((await noProduct.service.getSelfCheckoutOptions()).cycles).toEqual([])

    const inactive = makeHarness({ product: buildCrmProduct({ isActive: false }) })
    expect((await inactive.service.getSelfCheckoutOptions()).cycles).toEqual([])

    const cardOnly = makeHarness({
      product: buildCrmProduct({ paymentRules: [{ billingCycle: "monthly", paymentMethod: "CREDIT_CARD", price: "99" }] }),
    })
    expect((await cardOnly.service.getSelfCheckoutOptions()).cycles).toEqual([])
  })
})

describe("BackofficeAdhesionService.createSelfCheckout", () => {
  it("rejeita ciclo fora dos ciclos PIX do produto padrão sem criar lead nem adesão", async () => {
    const h = makeHarness()

    const failure = await h.service.createSelfCheckout({ ...request, cycle: "quadrimester" }).catch((error) => error)

    expect(failure).toBeInstanceOf(SelfCheckoutError)
    expect(failure).toMatchObject({ code: "CYCLE_UNAVAILABLE" })
    expect(h.repo.createSelfCheckoutLead).not.toHaveBeenCalled()
    expect(h.repo.createAndMoveLeadToAdhesion).not.toHaveBeenCalled()
  })

  it("rejeita ciclo quando não há produto padrão ativo", async () => {
    const h = makeHarness({ product: null })

    await expect(h.service.createSelfCheckout(request)).rejects.toMatchObject({ code: "CYCLE_UNAVAILABLE" })
    expect(h.repo.createAndMoveLeadToAdhesion).not.toHaveBeenCalled()
  })

  it("e-mail que já tem conta devolve ACCOUNT_EXISTS antes de criar qualquer coisa", async () => {
    const h = makeHarness()
    h.repo.findProfileIdByEmail.mockResolvedValue("profile-1")

    const failure = await h.service.createSelfCheckout(request).catch((error) => error)

    expect(failure).toBeInstanceOf(SelfCheckoutError)
    expect(failure).toMatchObject({ code: "ACCOUNT_EXISTS", message: "Já existe uma conta cadastrada com este e-mail" })
    expect(h.repo.findProfileIdByEmail).toHaveBeenCalledWith("maria@example.com")
    expect(h.repo.createSelfCheckoutLead).not.toHaveBeenCalled()
    expect(h.repo.createAndMoveLeadToAdhesion).not.toHaveBeenCalled()
  })

  it("cria lead da landing e adesão PIX com preço do servidor, ledger vazio, TTL 24h e devolve o token em texto puro", async () => {
    const h = makeHarness()

    const result = await h.service.createSelfCheckout({ ...request, email: "  Maria@Example.com " })

    expect(h.repo.createSelfCheckoutLead).toHaveBeenCalledWith({
      name: "Maria Souza",
      email: "maria@example.com",
      phone: "11999999999",
    })
    expect(h.repo.createAndMoveLeadToAdhesion).toHaveBeenCalledTimes(1)
    const data = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0]
    expect(data).toMatchObject({
      leadId: "lead-new",
      fullName: "Maria Souza",
      phone: "11999999999",
      billingType: "PIX",
      plan: "crm",
      productId: "prod-crm",
      cycle: "quarterly",
      modules: ["crm"],
      extraTeams: 0,
      extraUsers: 0,
      monthlyBaseAmount: 90,
      monthlyExtraTeamsAmount: 0,
      monthlyExtraUsersAmount: 0,
      monthlyTotalAmount: 89.9,
      totalAmount: 269.7,
      installmentSchedule: [269.7],
      installmentLedger: [],
      createdByBackofficeUserId: null,
    })
    expect(result.token).toMatch(/\S{20,}/)
    expect(data.tokenHash).toBe(hashBackofficeAdhesionToken(result.token))
    expect(data.tokenPlain).toBe(result.token)
    const ttl = (data.expiresAt as Date).getTime() - Date.now()
    expect(ttl).toBeGreaterThan(DAY_MS - 60_000)
    expect(ttl).toBeLessThanOrEqual(DAY_MS)
  })

  it("o preço vem sempre do produto no banco, nunca do pedido", async () => {
    const h = makeHarness()
    const tampered = { ...request, cycle: "annual" as const, totalAmount: 1, pixTotal: 1, price: 1 }

    await h.service.createSelfCheckout(tampered as never)

    expect(h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0]).toMatchObject({
      cycle: "annual",
      totalAmount: 900,
      monthlyTotalAmount: 75,
      hasUnlimitedUsers: true,
    })
  })

  it("não envia e-mail de checkout", async () => {
    const h = makeHarness()

    await h.service.createSelfCheckout(request)

    expect(checkoutEmail).not.toHaveBeenCalled()
  })

  // Segurança: o endpoint é público e só conhece o e-mail. Reaproveitar o lead ou a adesão de um
  // pedido anterior entregaria o token (e o acesso à página de pagamento) de outra pessoa, e
  // alterar o contato ou invalidar o PIX pendente dela. Cada pedido nasce isolado.
  it("nunca reaproveita lead nem adesão de outro pedido: cada pedido cria os seus e não altera nada existente", async () => {
    const h = makeHarness()

    const first = await h.service.createSelfCheckout(request)
    const second = await h.service.createSelfCheckout({ ...request, fullName: "Outra Pessoa", cycle: "annual" })

    expect(h.repo.createSelfCheckoutLead).toHaveBeenCalledTimes(2)
    expect(h.repo.createAndMoveLeadToAdhesion).toHaveBeenCalledTimes(2)
    expect(second.token).not.toBe(first.token)
    expect(h.repo.findByLeadId).not.toHaveBeenCalled()
    expect(h.repo.update).not.toHaveBeenCalled()
    expect(h.pixPayments.supersedePending).not.toHaveBeenCalled()
  })

})

describe("achado crítico: ledger e provider do PIX", () => {
  function createOperatorAdhesion() {
    const h = makeHarness()
    h.repo.getOptions.mockResolvedValue({
      leads: [buildLead({ id: "lead-op", email: "op@example.com" })],
      users: [],
      sponsorOptions: [],
    })
    return h
  }

  it("âncora do operador: create() em modo checkout grava parcela ASAAS pendente e o PIX Abacate é recusado", async () => {
    const h = createOperatorAdhesion()

    await h.service.create(
      { leadId: "lead-op", fullName: "Cliente Operador", phone: "11988887777", email: "op@example.com", cycle: "monthly", extraTeams: 0, extraUsers: 0 },
      "op-1"
    )

    const ledger = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0].installmentLedger as Array<Record<string, unknown>>
    expect(ledger.length).toBeGreaterThan(0)
    expect(ledger[0]).toMatchObject({ paymentSource: "ASAAS", status: "pending" })
    expect(resolvePixProvider({ installmentLedger: ledger })).toBe("ASAAS")

    h.repo.findById.mockResolvedValue(buildAdhesion({ installmentLedger: ledger }))
    await expect(h.service.createPixCheckout("tok", { fullName: "Maria Souza", email: "op@example.com", phone: "11999999999", cpfCnpj: "12345678909" }, "idem-1")).rejects.toThrow(
      "parcelas no Asaas"
    )
    expect(h.pixPayments.createPixPayment).not.toHaveBeenCalled()
  })

  it("auto-checkout: ledger vazio resolve ABACATE_PAY e createPixCheckout não lança o erro de incompatibilidade", async () => {
    const h = makeHarness()
    await h.service.createSelfCheckout(request)
    const created = h.repo.createAndMoveLeadToAdhesion.mock.calls[0][0]

    expect(resolvePixProvider({ installmentLedger: created.installmentLedger })).toBe("ABACATE_PAY")

    h.repo.findById.mockResolvedValue(buildAdhesion({ ...created, id: "adhesion-1", monthlyBaseAmount: String(created.monthlyBaseAmount), totalAmount: String(created.totalAmount) }))
    h.pixPayments.createPixPayment.mockResolvedValue({
      id: "pay-1",
      amountCents: 26970,
      providerExternalId: "pix_1",
      paymentInstructions: { brCode: "000201", brCodeBase64: "AAA", expiresAt: "2026-10-27T12:30:00.000Z" },
    } as never)

    const view = await h.service.createPixCheckout(
      "tok",
      { fullName: "Maria Souza", email: "maria@example.com", phone: "11999999999", cpfCnpj: "12345678909" },
      "idem-1"
    )

    expect(h.pixPayments.createPixPayment).toHaveBeenCalledTimes(1)
    const [pixInput] = (h.pixPayments.createPixPayment.mock.calls as unknown[][])[0]
    expect(pixInput).toMatchObject({ adhesionId: "adhesion-1", amountCents: 26970 })
    expect(view).toMatchObject({ provider: "ABACATE_PAY", billingType: "PIX", amount: 269.7 })
  })
})
