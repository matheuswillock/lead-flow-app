import { expect, test, type Page } from "@playwright/test"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { disconnectPrisma } from "../../support/db"
import { runResponsiveChecks } from "../../support/responsive"
import { API_CLIENT_BASE } from "../../../lib/route-map"

const appOrigin = new URL(process.env.E2E_BASE_URL || "http://127.0.0.1:3000").origin
const eventType = "schedule.created_or_rescheduled"
const webhookUrl = "https://sender.example.test/"
const apiBethaniaPath = `${API_CLIENT_BASE}/backoffice/bethania`
const overview = {
  paused: false,
  events: [{ eventType, description: "Agendamento criado ou reagendado", paused: false }],
  sender: { configured: true, health: "healthy", webhookUrl },
}

async function mockBethaniaApi(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    const pathname = url.pathname.startsWith(`${API_CLIENT_BASE}/`)
      ? url.pathname.replace(API_CLIENT_BASE, "/api/v1")
      : url.pathname
    if (url.origin !== appOrigin) return route.abort()
    if (pathname === "/api/v1/backoffice/bethania" && route.request().method() === "GET") {
      return route.fulfill({ json: overview })
    }
    if (pathname === "/api/v1/backoffice/bethania/logs") {
      return route.fulfill({
        json: {
          logs: [{ id: "log-e2e", eventType, status: "failed", errorCode: "HTTP_503", createdAt: "2026-11-23T12:00:00.000Z", attempts: 2 }],
          page: 1,
          pageSize: 25,
          total: 1,
        },
      })
    }
    if (pathname === "/api/v1/backoffice/bethania/controls" || pathname === "/api/v1/backoffice/bethania/sender") {
      return route.fulfill({ json: { updated: true, webhookUrl } })
    }
    if (pathname.startsWith("/api/v1/")) return route.fulfill({ status: 200, json: { isValid: true, result: {} } })
    return route.continue()
  })
}

test.describe("backoffice Bethânia", () => {
  test.beforeEach(async ({ context, page }) => {
    await injectE2eAuthCookie(context)
    await mockBethaniaApi(page)
  })

  test.afterAll(async () => {
    await disconnectPrisma()
  })

  test("exibe estado e logs; aciona pausa global e por evento", async ({ page }) => {
    await page.goto("/backoffice/studio-bot")
    const newsClose = page.getByRole("button", { name: "Close" })
    if (await newsClose.isVisible().catch(() => false)) await newsClose.click()
    const promptDismiss = page.getByRole("button", { name: "Agora não" })
    if (await promptDismiss.isVisible().catch(() => false)) await promptDismiss.click()
    await expect(page.getByRole("heading", { name: "Bethânia · automações" })).toBeVisible()
    await expect(page.getByText("Conector saudável")).toBeVisible()
    await expect(page.getByRole("textbox", { name: "URL do webhook" })).toHaveValue(webhookUrl)
    await expect(page.getByText(/HTTP_503/)).toBeVisible()

    const senderUpdate = page.waitForRequest((request) => request.url().includes(`${apiBethaniaPath}/sender`) && request.method() === "PATCH")
    await page.getByRole("button", { name: "Salvar URL" }).click()
    expect((await senderUpdate).postDataJSON()).toEqual({ webhookUrl })

    const globalPause = page.getByRole("switch", { name: "Pausa de emergência" })
    await globalPause.click()
    await expect(globalPause).toHaveAttribute("aria-checked", "true")

    await page.getByRole("switch", { name: "Pausar agendamento criado ou reagendado" }).click()
    await runResponsiveChecks(page)
  })
})
