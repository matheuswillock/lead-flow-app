/**
 * Checkout público de `/adesao/[token]` com PIX cobrado pelo Abacate, nos dois fluxos:
 * - "adesão compartilhada" (adesões do cadastro administrativo, sem `isSelfCheckout`);
 * - "self-checkout" (`isSelfCheckout: true`), em fases: seus dados, endereço ou cartão.
 *
 * O proxy valida o token no banco, então a adesão pendente é semeada via Prisma. Todo o backend
 * de pagamento é mockado com `page.route`: nenhum pagamento, cliente ou cobrança é criado em
 * provider algum.
 */

import { createHash, randomUUID } from "node:crypto"
import { expect, test, type Page } from "@playwright/test"
import { disconnectPrisma, getPrisma } from "../../support/db"
import { runResponsiveChecks } from "../../support/responsive"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaAny = any

const TOKEN = `e2e-adesao-${randomUUID()}`
const PIX_CODE = "00020126E2EADESAOPIXCOPIAECOLA"
const FAR_FUTURE = "2999-01-01T12:00:00.000Z"
const PAST = "2000-01-01T12:00:00.000Z"

function envelope(result: unknown) {
  return JSON.stringify({ isValid: true, successMessages: [], errorMessages: [], result })
}

function detailsPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "e2e-adhesion",
    fullName: "Maria Souza",
    phone: "11999998888",
    cpfCnpj: "52998224725",
    email: "maria@example.com",
    billingType: "PIX",
    status: "pending",
    cycle: "monthly",
    cycleLabel: "Plano mensal",
    cycleMonths: 1,
    modules: ["crm"],
    extraTeams: 0,
    extraUsers: 0,
    monthlyBaseAmount: 299.9,
    monthlyExtraTeamsAmount: 0,
    monthlyExtraUsersAmount: 0,
    monthlyTotalAmount: 299.9,
    totalAmount: 299.9,
    maxInstallments: 1,
    pixMonthlyTotalAmount: 299.9,
    pixTotalAmount: 299.9,
    creditCardMonthlyTotalAmount: 329.9,
    creditCardTotalAmount: 329.9,
    maxCardInstallments: 3,
    installmentSplitMode: null,
    installmentSchedule: [],
    remainingBalance: 299.9,
    chargeAmount: 299.9,
    availableBillingTypes: ["PIX"],
    pixProvider: "ABACATE_PAY",
    createdAt: new Date().toISOString(),
    paidAt: null,
    expiresAt: FAR_FUTURE,
    ...overrides,
  }
}

function pixPayload(expiresAt: string, status: "pending" | "paid" = "pending") {
  return {
    adhesionId: "e2e-adhesion",
    paymentId: "pix_char_e2e",
    provider: "ABACATE_PAY",
    status,
    billingType: "PIX",
    amount: 299.9,
    invoiceUrl: null,
    bankSlipUrl: null,
    pix: { encodedImage: "iVBORw0KGgo=", payload: PIX_CODE, expirationDate: expiresAt },
  }
}

async function mockAdhesionApi(
  page: Page,
  pixExpirations: string[] = [FAR_FUTURE],
  details: Record<string, unknown> = {},
) {
  const state = {
    status: "pending" as "pending" | "paid",
    pixRequests: [] as { body: Record<string, unknown> }[],
    checkoutRequests: 0,
    currentExpiration: pixExpirations[0],
  }

  await page.route(`**/api/**/public-adhesions/${TOKEN}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: envelope(detailsPayload(details)) })
  })

  await page.route(`**/api/**/public-adhesions/${TOKEN}/checkout`, async (route) => {
    state.checkoutRequests += 1
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ isValid: false, errorMessages: ["indisponível"] }) })
  })

  await page.route(`**/api/**/public-adhesions/${TOKEN}/pix`, async (route) => {
    state.pixRequests.push({ body: route.request().postDataJSON() as Record<string, unknown> })
    state.currentExpiration = pixExpirations[Math.min(state.pixRequests.length - 1, pixExpirations.length - 1)]
    await route.fulfill({ status: 201, contentType: "application/json", body: envelope(pixPayload(state.currentExpiration)) })
  })

  await page.route(`**/api/**/public-adhesions/${TOKEN}/payment-status**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope(pixPayload(state.currentExpiration, state.status)),
    })
  })

  return state
}

/** Adesão compartilhada (sem isSelfCheckout): Resumo é a primeira fase; Continuar leva a Pagamento. */
async function openSharedPaymentPhase(page: Page) {
  await page.goto(`/adesao/${TOKEN}`)
  await page.getByRole("button", { name: "Continuar" }).click()
  await expect(page.getByLabel("Nome completo")).toBeVisible()
}

async function fillSharedPayer(page: Page) {
  await page.getByLabel("Nome completo").fill("Maria Souza")
  await page.getByLabel("E-mail").fill("maria@example.com")
  await page.getByLabel("Telefone").fill("11999998888")
  await page.getByLabel("CPF ou CNPJ").fill("52998224725")
}

/** Self-checkout PIX: fase única "Seus dados" (o WhatsApp no lugar do telefone); o envio fica na lateral. */
async function fillSelfPayer(page: Page) {
  await page.getByLabel("Nome completo").fill("Maria Souza")
  await page.getByLabel("E-mail").fill("maria@example.com")
  await page.getByLabel("WhatsApp").fill("11999998888")
}

test.describe("adesao — PIX Abacate no checkout público", () => {
  let leadId: string | null = null
  let adhesionId: string | null = null

  test.beforeAll(async () => {
    const prisma: PrismaAny = getPrisma()
    const lead = await prisma.backofficeLead.create({
      data: { name: "E2E Adesao Lead", email: `e2e.adesao.${Date.now()}@example.com`, phone: "11999999999", status: "new_adhesion" },
      select: { id: true },
    })
    leadId = lead.id
    const adhesion = await prisma.backofficeAdhesion.create({
      data: {
        leadId: lead.id,
        fullName: "Maria Souza",
        phone: "11999998888",
        plan: "crm",
        cycle: "monthly",
        modules: ["crm"],
        extraTeams: 0,
        extraUsers: 0,
        monthlyBaseAmount: 299.9,
        monthlyExtraTeamsAmount: 0,
        monthlyExtraUsersAmount: 0,
        monthlyTotalAmount: 299.9,
        totalAmount: 299.9,
        billingType: "PIX",
        tokenHash: createHash("sha256").update(TOKEN).digest("hex"),
        tokenPreview: TOKEN.slice(0, 8),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: "pending",
      } as PrismaAny,
      select: { id: true },
    })
    adhesionId = adhesion.id
  })

  test.afterAll(async () => {
    const prisma: PrismaAny = getPrisma()
    if (adhesionId) await prisma.backofficeAdhesion.deleteMany({ where: { id: adhesionId } }).catch(() => null)
    if (leadId) await prisma.backofficeLead.deleteMany({ where: { id: leadId } }).catch(() => null)
    await disconnectPrisma()
  })

  test("oferece só PIX, gera QR e copia-e-cola pelo Abacate e confirma o pagamento", async ({ page }) => {
    const mock = await mockAdhesionApi(page)

    await openSharedPaymentPhase(page)

    await expect(page.getByText("Cartão de crédito")).toHaveCount(0)
    await expect(page.getByText("CEP")).toHaveCount(0)

    // Aceite implícito: aviso ao lado do botão, sem caixa de aceite.
    await expect(page.getByText("Ao pagar, você concorda com os")).toBeVisible()
    await expect(page.getByRole("checkbox")).toHaveCount(0)

    const submit = page.getByRole("button", { name: "Gerar QR Code PIX" })
    await fillSharedPayer(page)
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect(page.getByText(PIX_CODE)).toBeVisible()
    await expect(page.getByAltText("QR Code PIX")).toBeVisible()
    await expect(page.getByRole("button", { name: "Copiar", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Gerar novo PIX" })).toHaveCount(0)
    await expect(page.getByText("Pagamento processado pela AbacatePay")).toBeVisible()
    await expect(page.getByAltText("Asaas Pagamentos")).toHaveCount(0)

    expect(mock.checkoutRequests).toBe(0)
    expect(mock.pixRequests).toHaveLength(1)
    expect(mock.pixRequests[0].body).toMatchObject({
      fullName: "Maria Souza",
      email: "maria@example.com",
      phone: "11999998888",
      cpfCnpj: "52998224725",
      termsAccepted: true,
    })
    expect(String(mock.pixRequests[0].body.idempotencyKey)).toContain("adhesion-pix:")
    expect(mock.pixRequests[0].body).not.toHaveProperty("amount")

    // A confirmação chega pelo auto-refresh do fluxo (GET payment-status, a cada 8s).
    mock.status = "paid"
    await expect(page.getByText("Pagamento confirmado")).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText("Boas-vindas ao Corretor Studio.")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Seu acesso foi enviado" })).toBeVisible()

    await runResponsiveChecks(page)
  })

  test("PIX expirado oferece Gerar novo PIX com chave de idempotência nova", async ({ page }) => {
    const mock = await mockAdhesionApi(page, [PAST, FAR_FUTURE])

    await openSharedPaymentPhase(page)
    await fillSharedPayer(page)
    await page.getByRole("button", { name: "Gerar QR Code PIX" }).click()

    await expect(page.getByText("Este PIX expirou")).toBeVisible()
    await page.getByRole("button", { name: "Gerar novo PIX" }).click()

    await expect(page.getByText("Este PIX expirou")).toHaveCount(0)
    expect(mock.pixRequests).toHaveLength(2)
    expect(mock.pixRequests[1].body.idempotencyKey).not.toBe(mock.pixRequests[0].body.idempotencyKey)
    expect(mock.pixRequests[1].body.cpfCnpj).toBe(mock.pixRequests[0].body.cpfCnpj)

    await runResponsiveChecks(page)
  })

  test("mantém o layout sem overflow em 360px e no desktop com o PIX exibido", async ({ page }) => {
    await mockAdhesionApi(page)

    await openSharedPaymentPhase(page)
    await fillSharedPayer(page)
    await page.getByRole("button", { name: "Gerar QR Code PIX" }).click()
    await expect(page.getByText(PIX_CODE)).toBeVisible()

    await page.setViewportSize({ width: 360, height: 800 })
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(mobileOverflow).toBeLessThanOrEqual(1)

    await page.setViewportSize({ width: 1280, height: 720 })
    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(desktopOverflow).toBeLessThanOrEqual(1)
    await expect(page.getByText(PIX_CODE)).toBeVisible()

    await runResponsiveChecks(page)
  })

  test("self-checkout PIX Abacate: uma fase de dados, forma de pagamento na lateral e QR no envio", async ({ page }) => {
    const mock = await mockAdhesionApi(page, [FAR_FUTURE], { isSelfCheckout: true, companyName: "Imobiliária Exemplo" })

    await page.goto(`/adesao/${TOKEN}`)

    await expect(page.getByRole("heading", { name: "Contrate o Corretor Studio" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Seus dados" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Forma de pagamento" })).toBeVisible()
    await expect(page.getByText("Cartão de crédito")).toHaveCount(0)
    await expect(page.getByText("CEP")).toHaveCount(0)
    // Uma única fase: não há Continuar, o envio fica na lateral.
    await expect(page.getByRole("button", { name: "Continuar" })).toHaveCount(0)
    await expect(page.getByText("Ao pagar, você concorda com os")).toBeVisible()
    await expect(page.getByRole("checkbox")).toHaveCount(0)

    await fillSelfPayer(page)
    await page.getByRole("button", { name: "Gerar QR Code PIX" }).click()

    await expect(page.getByText(PIX_CODE)).toBeVisible()
    await expect(page.getByAltText("QR Code PIX")).toBeVisible()
    await expect(page.getByRole("button", { name: "Copiar", exact: true })).toBeVisible()
    expect(mock.checkoutRequests).toBe(0)
    expect(mock.pixRequests).toHaveLength(1)
    expect(mock.pixRequests[0].body).toMatchObject({
      fullName: "Maria Souza",
      email: "maria@example.com",
      phone: "11999998888",
      cpfCnpj: "52998224725",
      termsAccepted: true,
    })

    mock.status = "paid"
    await expect(page.getByRole("heading", { name: "Pagamento confirmado" })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText("Boas-vindas ao Corretor Studio, Imobiliária Exemplo.")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Seu acesso foi enviado" })).toBeVisible()

    await runResponsiveChecks(page)
  })

  test("self-checkout PIX legado: endereço numa fase própria, valida antes de avançar e volta sem perder dados", async ({ page }) => {
    await mockAdhesionApi(page, [FAR_FUTURE], { isSelfCheckout: true, pixProvider: "ASAAS" })

    await page.goto(`/adesao/${TOKEN}`)

    const name = page.getByLabel(/Nome completo/)
    await name.fill("")
    await page.getByRole("button", { name: "Continuar" }).click()
    await expect(page.getByText("Informe o nome completo.")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Seus dados" })).toBeVisible()

    await name.fill("Maria Souza")
    await page.getByRole("button", { name: "Continuar" }).click()
    await expect(page.getByRole("heading", { name: "Endereço de cobrança" })).toBeVisible()
    await expect(page.getByLabel(/CEP/)).toBeVisible()

    await page.getByRole("button", { name: "Voltar" }).click()
    await expect(page.getByRole("heading", { name: "Seus dados" })).toBeVisible()
    await expect(name).toHaveValue("Maria Souza")
  })
})
