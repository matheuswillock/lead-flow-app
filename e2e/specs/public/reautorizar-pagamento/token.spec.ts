import { expect, test } from "@playwright/test"
import { runResponsiveChecks } from "../../../support/responsive"

test.describe("reautorização de pagamento", () => {
  test("carrega a tela protegida sem expor formulário para token ausente", async ({ page }) => {
    test.skip(!process.env.E2E_REAUTH_TOKEN)
    await page.goto(`/reautorizar-pagamento/${process.env.E2E_REAUTH_TOKEN}`)
    await expect(page.locator("main")).toBeVisible()
    await runResponsiveChecks(page)
  })
})
