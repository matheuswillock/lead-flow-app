import { expect, test } from "@playwright/test"
import { runResponsiveChecks } from "../../../support/responsive"

test.describe("checkout público por intenção", () => {
  test("renderiza a etapa de escolha de método", async ({ page }) => {
    await page.goto("/checkout/test-token")
    await expect(page.getByRole("heading", { name: /Escolha a forma de pagamento/i })).toBeVisible()
    await runResponsiveChecks(page)
  })
})
