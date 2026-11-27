import { randomUUID } from "node:crypto"
import { expect, test, type Page } from "@playwright/test"
import { API_CLIENT_BASE } from "../../../lib/route-map"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { disconnectPrisma, getPrisma } from "../../support/db"
import { runResponsiveChecks } from "../../support/responsive"

const appOrigin = new URL(
  process.env.E2E_BASE_URL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://127.0.0.1:3000",
).origin

type WhatsAppFixture = { profileId: string; supabaseId: string; email: string; teamId: string }

async function createWhatsAppFixture(): Promise<WhatsAppFixture> {
  const prisma = getPrisma()
  const supabaseId = randomUUID()
  const email = `e2e.whatsapp-verification.${randomUUID()}@example.com`
  const profile = await prisma.profile.create({
    data: {
      supabaseId,
      email,
      fullName: "E2E WhatsApp User",
      isMaster: true,
      hasPermanentSubscription: true,
      subscriptionStatus: "active",
      whatsappPhone: null,
      whatsappPhoneVerifiedAt: null,
    },
    select: { id: true },
  })
  const team = await prisma.team.create({
    data: { name: `E2E WhatsApp ${supabaseId.slice(0, 8)}`, masterId: profile.id },
  })
  await prisma.teamMember.create({ data: { teamId: team.id, profileId: profile.id, role: "manager" } })
  await prisma.profile.update({ where: { id: profile.id }, data: { activeTeamId: team.id } })
  return { profileId: profile.id, supabaseId, email, teamId: team.id }
}

async function deleteWhatsAppFixture(fixture: WhatsAppFixture) {
  const prisma = getPrisma()
  await prisma.profile.update({ where: { id: fixture.profileId }, data: { activeTeamId: null } })
  await prisma.teamMember.deleteMany({ where: { profileId: fixture.profileId } })
  await prisma.team.deleteMany({ where: { id: fixture.teamId } })
  await prisma.profile.deleteMany({ where: { id: fixture.profileId } })
}

const dashboardPath = (supabaseId: string) => `/${supabaseId}/dashboard`
const accountPath = (supabaseId: string) => `/${supabaseId}/account`
const phone = "+15551234567"

async function dismissAnnouncement(page: Page) {
  const closeButton = page.getByRole("button", { name: "Close" })
  await expect(closeButton).toBeVisible()
  await closeButton.click()
  await expect(page.getByRole("dialog", { name: /Novidades no Corretor Studio/ })).toBeHidden()
}

async function mockAccountApi(
  page: Page,
  profileId: string,
  options: { requestError?: boolean } = {},
) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== appOrigin) return route.abort()
    const pathname = url.pathname.startsWith(`${API_CLIENT_BASE}/`)
      ? url.pathname.replace(API_CLIENT_BASE, "/api/v1")
      : url.pathname

    if (pathname.endsWith("/whatsapp-verification/request-code")) {
      return options.requestError
        ? route.fulfill({ status: 400, json: { error: "Falha simulada ao enviar código." } })
        : route.fulfill({ status: 202, json: { success: true, challengeId: "fake-challenge" } })
    }

    if (pathname.endsWith("/whatsapp-verification/verify-code")) {
      const body = route.request().postDataJSON() as { challengeId?: string; code?: string }
      if (body.challengeId !== "fake-challenge" || body.code !== "654321") {
        return route.fulfill({ status: 400, json: { error: "Código inválido ou expirado." } })
      }
      await getPrisma().profile.update({
        where: { id: profileId },
        data: { whatsappPhoneVerifiedAt: new Date() },
      })
      return route.fulfill({ status: 200, json: { success: true } })
    }

    // Let the isolated E2E app persist profile state; external providers stay blocked.
    return route.continue()
  })
}

test.describe("verificação de WhatsApp na conta", () => {
  let fixture: WhatsAppFixture | undefined

  test.beforeEach(async ({ context }) => {
    fixture = await createWhatsAppFixture()
    await injectE2eAuthCookie(context, { supabaseId: fixture.supabaseId, email: fixture.email })
  })

  test.afterEach(async () => {
    if (fixture) await deleteWhatsAppFixture(fixture)
    fixture = undefined
  })

  test.afterAll(async () => {
    await disconnectPrisma()
  })

  test("usuário verificado não recebe alerta e vê o estado confirmado no painel", async ({ page }) => {
    const user = fixture!
    await getPrisma().profile.update({
      where: { id: user.profileId },
      data: { whatsappPhone: phone, whatsappPhoneVerifiedAt: new Date() },
    })
    await mockAccountApi(page, user.profileId)

    await page.goto(dashboardPath(user.supabaseId))
    await dismissAnnouncement(page)

    await expect(page.getByRole("main")).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole("heading", { name: "Verifique seu WhatsApp" })).toHaveCount(0)
    await page.goto(accountPath(user.supabaseId))
    await dismissAnnouncement(page)
    await expect(page.getByRole("heading", { name: "WhatsApp para notificações" })).toBeVisible()
    await expect(page.getByRole("status", { name: "WhatsApp verificado" })).toBeVisible()
    await runResponsiveChecks(page)
  })

  test("alerta abre Minha conta e a confirmação retorna ao destino sem expor o OTP na URL", async ({ page }) => {
    const user = fixture!
    const originalPath = dashboardPath(user.supabaseId)
    const userAccountPath = accountPath(user.supabaseId)
    await mockAccountApi(page, user.profileId)

    await page.goto(originalPath)
    await dismissAnnouncement(page)
    await expect(page.getByRole("heading", { name: "Verifique seu WhatsApp" })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole("button", { name: "Ir para minha conta" }).click()

    await expect(page).toHaveURL(new RegExp(`${userAccountPath.replaceAll("/", "\\/")}\\?returnTo=`))
    await expect(page.getByText("Minha conta", { exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "WhatsApp para notificações" })).toBeVisible()

    const phoneInput = page.getByRole("textbox", { name: "Número de WhatsApp" })
    await phoneInput.fill(phone)
    await page.getByRole("button", { name: "Salvar número" }).click()
    await page.getByRole("button", { name: "Enviar código" }).click()
    const otp = page.getByLabel("Código de verificação")
    await expect(otp).toBeVisible()
    await otp.fill("654321")
    expect(page.url()).not.toContain("654321")
    await page.getByRole("button", { name: "Confirmar código" }).click()

    await expect(page).toHaveURL(originalPath)
    const promptDismiss = page.getByRole("button", { name: "Agora não" })
    if (await promptDismiss.isVisible().catch(() => false)) await promptDismiss.click()
    await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible()
    expect(page.url()).not.toContain("654321")
  })

  test("erro do transporte falso permanece acessível no painel e não expõe o código", async ({ page }) => {
    const user = fixture!
    await mockAccountApi(page, user.profileId, { requestError: true })

    await page.goto(accountPath(user.supabaseId))
    await dismissAnnouncement(page)
    await expect(page.getByRole("heading", { name: "WhatsApp para notificações" })).toBeVisible({
      timeout: 30_000,
    })
    const phoneInput = page.getByRole("textbox", { name: "Número de WhatsApp" })
    await phoneInput.fill(phone)
    await page.getByRole("button", { name: "Salvar número" }).click()
    await page.getByRole("button", { name: "Enviar código" }).click()
    await expect(page.getByRole("alert")).toHaveText("Falha simulada ao enviar código.")
    expect(page.url()).not.toContain("654321")
  })
})
