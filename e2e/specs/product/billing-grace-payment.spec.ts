import { expect, test } from "@playwright/test"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids"
import { runResponsiveChecks } from "../../support/responsive"
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal"

test.describe("regularização da assinatura", () => {
  test("exibe quote PIX e inicia o pagamento sem checkout externo", async ({ context, page }) => {
    await injectE2eAuthCookie(context)
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
      },
      { supabaseId: E2E_MASTER_SUPABASE_ID, version: WHATS_NEW_VERSION },
    )
    let paymentCreated = false

    await page.route("**/api/**/billing-grace-payment**", async (route) => {
      if (route.request().method() === "POST") {
        paymentCreated = true
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            isValid: true,
            successMessages: [],
            errorMessages: [],
            result: {
              id: "grace-payment-e2e",
              status: "pending",
              amountCents: 5990,
              effectivePriceCents: 5990,
              paymentInstructions: {
                brCode: "000201PIX-E2E",
                brCodeBase64: "iVBORw0KGgo=",
                expiresAt: new Date(Date.now() + 600_000).toISOString(),
              },
            },
          }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          isValid: true,
          successMessages: [],
          errorMessages: [],
          result: {
            cycles: [
              {
                cycle: "monthly",
                label: "Mensal",
                months: 1,
                periodStart: new Date().toISOString(),
                periodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
                planPixTotal: 59.9,
                planCardTotal: null,
                maxInstallments: 1,
                unlimitedUsers: false,
                billedUsers: [],
                accountUsers: [],
                billedTeams: [],
                extraUserPrice: 0,
                extraTeamPrice: 0,
                extraUsersTotal: 0,
                extraTeamsTotal: 0,
                pixTotal: 59.9,
                cardTotal: null,
                losesUnlimitedUsers: false,
              },
            ],
            currentCycle: "monthly",
            hasUnlimitedUsers: false,
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
            cardCheckout: null,
          },
        }),
      })
    })

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/billing-grace-payment`)
    await expect(page.getByRole("heading", { name: "Renove sua assinatura" })).toBeVisible()
    await expect(page.getByText("R$ 59,90").first()).toBeAttached()
    await page.getByRole("button", { name: "Gerar QR Code PIX" }).click()
    await expect(page.getByText("000201PIX-E2E")).toBeAttached()
    await expect(page.getByAltText("QR Code PIX")).toBeVisible()
    await expect(page.getByRole("button", { name: "Copiar", exact: true })).toBeVisible()
    expect(paymentCreated).toBe(true)
    await runResponsiveChecks(page)
  })
})
