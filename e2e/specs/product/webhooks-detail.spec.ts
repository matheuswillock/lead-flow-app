import { expect, test, type Page } from "@playwright/test"
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids"
import { runResponsiveChecks } from "../../support/responsive"

const DETAIL_WEBHOOKS = [
  { direction: "inbound", title: "Webhook de entrada E2E" },
  { direction: "outbound", title: "Webhook de saída E2E" },
] as const

type WebhookDirection = (typeof DETAIL_WEBHOOKS)[number]["direction"]

function webhookSummary(direction: WebhookDirection, title: string) {
  return {
    id: `e2e-${direction}-detail-webhook`,
    direction,
    status: "active",
    name: title,
    targetUrl: direction === "outbound" ? "https://example.com/webhook" : null,
    destinationPreset: direction === "outbound" ? "generic" : null,
    selectedEvents: direction === "outbound" ? ["lead_created"] : [],
    failureStreak: 0,
    failureThreshold: 3,
    lastUsedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    pausedAt: null,
    pauseReason: null,
    tokenPreview: direction === "inbound" ? "token…1234" : null,
    expiryMode: null,
    expiresAt: null,
    webhookUrl: direction === "inbound" ? "https://example.com/inbound/token" : null,
    createdAt: "2026-09-25T14:00:00.000Z",
    updatedAt: "2026-09-25T14:00:00.000Z",
  }
}

function logPayload(direction: WebhookDirection) {
  return direction === "outbound"
    ? { id: "evt-e2e", type: "lead_created", data: { lead_id: "lead-e2e", name: "Lead E2E" } }
    : { event: "lead_received", data: { lead_id: "lead-e2e" } }
}

async function mockDetailApi(page: Page, direction: WebhookDirection, title: string) {
  const webhookId = `e2e-${direction}-detail-webhook`
  const summary = webhookSummary(direction, title)
  const log = {
    id: `e2e-${direction}-log`,
    teamId: "e2e-team",
    webhookId,
    direction,
    result: "success",
    eventKey: direction === "outbound" ? "lead_created" : null,
    method: "POST",
    endpoint: summary.targetUrl ?? "https://example.com/inbound/token",
    statusCode: 200,
    requestPayload: logPayload(direction),
    responsePayload: { accepted: true },
    errorMessage: null,
    createdAt: "2026-09-25T14:01:00.000Z",
  }

  await page.route(`**/integrations/webhooks/${webhookId}*`, async (route) => {
    const url = new URL(route.request().url())
    const isLogsRequest = url.pathname.endsWith("/logs") || url.pathname.includes("/logs/")
    const result = isLogsRequest
      ? { items: [log], total: 1, page: 1, pageSize: 20 }
      : summary
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ isValid: true, successMessages: [], errorMessages: [], result }),
    })
  })
}

test.describe("webhooks: páginas de detalhe", () => {
  test.setTimeout(90_000)

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context)
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
      },
      { supabaseId: E2E_MASTER_SUPABASE_ID, version: WHATS_NEW_VERSION },
    )
  })

  for (const detail of DETAIL_WEBHOOKS) {
    test(`${detail.direction} carrega logs e passa nas checagens responsivas`, async ({ page }) => {
      const webhookId = `e2e-${detail.direction}-detail-webhook`
      await mockDetailApi(page, detail.direction, detail.title)
      await page.goto(
        `/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/${detail.direction}/${webhookId}`,
        { waitUntil: "domcontentloaded" },
      )
      await expect(page.getByRole("heading", { name: detail.title })).toBeVisible({ timeout: 30_000 })
      await page.getByRole("tab", { name: "Logs" }).click()
      await expect(page.getByText("Entregas", { exact: true })).toBeVisible()
      await expect(page.getByText("Detalhes", { exact: true })).toBeVisible()

      if (detail.direction === "inbound") {
        await expect(page.getByRole("button", { name: /reenviar webhook/i })).toHaveCount(0)
      }

      await runResponsiveChecks(page)
    })
  }
})
