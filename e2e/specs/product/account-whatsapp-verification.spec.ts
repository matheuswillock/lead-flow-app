import { expect, test, type Page } from "@playwright/test"
import { E2E_MASTER_EMAIL, E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids"
import { API_CLIENT_BASE } from "../../../lib/route-map"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { runResponsiveChecks } from "../../support/responsive"

const supabaseId = E2E_MASTER_SUPABASE_ID
const originalPath = `/${supabaseId}/dashboard`
const appOrigin = new URL(
  process.env.E2E_BASE_URL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://127.0.0.1:3000",
).origin
const matchesAppApi = (url: URL) =>
  url.origin === appOrigin &&
  (url.pathname.startsWith(`${API_CLIENT_BASE}/`) || url.pathname.startsWith("/api/v1/"))
const accountPath = `/${supabaseId}/account`
const phone = "+15551234567"

async function dismissAnnouncement(page: Page) {
  const closeButton = page.getByRole("button", { name: "Close" })
  await expect(closeButton).toBeVisible()
  await closeButton.click()
  await expect(page.getByRole("dialog", { name: /Novidades no Corretor Studio/ })).toBeHidden()
}

async function mockAccountApi(
  page: Page,
  options: { verified?: boolean; requestError?: boolean } = {},
) {
  let verified = options.verified ?? false
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.origin !== appOrigin) return route.abort()
    return route.continue()
  })

  await page.route(matchesAppApi, async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const pathname = url.pathname

    if (pathname.endsWith(`/profiles/${supabaseId}`) && method === "GET") {
      return route.fulfill({
        json: {
          isValid: true,
          result: {
            id: supabaseId,
            supabaseId,
            email: E2E_MASTER_EMAIL,
            fullName: "E2E WhatsApp User",
            phone: null,
            whatsappPhone: phone,
            whatsappPhoneVerifiedAt: verified ? "2026-11-23T12:00:00.000Z" : null,
            isMaster: true,
            functions: [],
            googleCalendarConnected: false,
          },
        },
      })
    }

    if (pathname.endsWith("/subscriptions/check")) {
      return route.fulfill({
        json: {
          isValid: true,
          result: { userExists: true, hasActiveSubscription: true, userRole: "master" },
        },
      })
    }

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
      verified = true
      return route.fulfill({ status: 200, json: { success: true } })
    }

    // Keep this acceptance spec hermetic: no unhandled API or provider traffic.
    return route.fulfill({ status: 200, json: { isValid: true, result: {} } })
  })
}

test.describe("verificação de WhatsApp na conta", () => {
  test("usuário verificado não recebe alerta e vê o estado confirmado no painel", async ({
    context,
    page,
  }) => {
    await injectE2eAuthCookie(context, { supabaseId, email: E2E_MASTER_EMAIL })
    await mockAccountApi(page, { verified: true })

    await page.goto(originalPath)
    await dismissAnnouncement(page)

    await expect(page.getByRole("main")).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole("heading", { name: "Verifique seu WhatsApp" })).toHaveCount(0)
    await page.goto(accountPath)
    await dismissAnnouncement(page)
    await expect(page.getByRole("heading", { name: "WhatsApp para notificações" })).toBeVisible()
    await expect(page.getByRole("status", { name: "WhatsApp verificado" })).toBeVisible()
    await runResponsiveChecks(page)
  })

  test("alerta abre Minha conta e a confirmação retorna ao destino sem expor o OTP na URL", async ({
    context,
    page,
  }) => {
    await injectE2eAuthCookie(context, { supabaseId, email: E2E_MASTER_EMAIL })
    await mockAccountApi(page)

    await page.goto(originalPath)
    await dismissAnnouncement(page)
    await expect(page.getByRole("heading", { name: "Verifique seu WhatsApp" })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole("button", { name: "Ir para minha conta" }).click()

    await expect(page).toHaveURL(new RegExp(`${accountPath.replaceAll("/", "\\/")}\\?returnTo=`))
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

  test("erro do transporte falso permanece acessível no painel e não expõe o código", async ({
    context,
    page,
  }) => {
    await injectE2eAuthCookie(context, { supabaseId, email: E2E_MASTER_EMAIL })
    await mockAccountApi(page, { requestError: true })

    await page.goto(accountPath)
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
