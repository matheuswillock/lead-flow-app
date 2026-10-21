/**
 * Checkout público da "Nova adesão" do backoffice (`/adesao/[token]`) com PIX cobrado pelo Abacate.
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

function detailsPayload() {
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

async function mockAdhesionApi(page: Page, pixExpirations: string[] = [FAR_FUTURE]) {
  const state = {
    status: "pending" as "pending" | "paid",
    pixRequests: [] as { body: Record<string, unknown> }[],
    checkoutRequests: 0,
    currentExpiration: pixExpirations[0],
  }

  await page.route(`**/api/**/public-adhesions/${TOKEN}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: envelope(detailsPayload()) })
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

async function fillPayer(page: Page) {
  const fields = page.getByRole("textbox")
  await fields.nth(0).fill("Maria Souza")
  await fields.nth(1).fill("maria@example.com")
  await fields.nth(2).fill("11999998888")
  await fields.nth(3).fill("52998224725")
}

async function openPaymentStep(page: Page) {
  await page.goto(`/adesao/${TOKEN}`)
  await page.getByRole("button", { name: /Finalizar Pagamento/ }).click()
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

    await openPaymentStep(page)

    await expect(page.getByText("Cartão de crédito")).toHaveCount(0)
    await expect(page.getByText("CEP")).toHaveCount(0)

    const submit = page.getByRole("button", { name: "Gerar QR Code Pix" })
    await fillPayer(page)
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect(page.getByText(PIX_CODE)).toBeVisible()
    await expect(page.getByAltText("QR Code PIX")).toBeVisible()
    await expect(page.getByRole("button", { name: "Copiar código PIX" })).toBeVisible()
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
    })
    expect(String(mock.pixRequests[0].body.idempotencyKey)).toContain("adhesion-pix:")
    expect(mock.pixRequests[0].body).not.toHaveProperty("amount")

    // A confirmação chega pelo auto-refresh do fluxo (GET payment-status, a cada 8s).
    mock.status = "paid"
    await expect(page.getByText("Pagamento confirmado")).toBeVisible({ timeout: 20_000 })

    await runResponsiveChecks(page)
  })

  test("PIX expirado oferece Gerar novo PIX com chave de idempotência nova", async ({ page }) => {
    const mock = await mockAdhesionApi(page, [PAST, FAR_FUTURE])

    await openPaymentStep(page)
    await fillPayer(page)
    await page.getByRole("button", { name: "Gerar QR Code Pix" }).click()

    await expect(page.getByText("Este PIX expirou. Gere um novo PIX para pagar.")).toBeVisible()
    await page.getByRole("button", { name: "Gerar novo PIX" }).click()

    await expect(page.getByText("Este PIX expirou. Gere um novo PIX para pagar.")).toHaveCount(0)
    expect(mock.pixRequests).toHaveLength(2)
    expect(mock.pixRequests[1].body.idempotencyKey).not.toBe(mock.pixRequests[0].body.idempotencyKey)
    expect(mock.pixRequests[1].body.cpfCnpj).toBe(mock.pixRequests[0].body.cpfCnpj)

    await runResponsiveChecks(page)
  })

  test("mantém o layout sem overflow em 360px e no desktop com o PIX exibido", async ({ page }) => {
    await mockAdhesionApi(page)

    await openPaymentStep(page)
    await fillPayer(page)
    await page.getByRole("button", { name: "Gerar QR Code Pix" }).click()
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
})
