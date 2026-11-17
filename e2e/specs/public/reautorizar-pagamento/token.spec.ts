import { expect, test } from "@playwright/test"
import { runResponsiveChecks } from "../../../support/responsive"

// Token inexistente de propósito: o spec cobre a tela protegida sem expor o
// formulário de cartão. `E2E_REAUTH_TOKEN` só existe para apontar outro token.
const ABSENT_TOKEN = process.env.E2E_REAUTH_TOKEN ?? "e2e-token-inexistente"

test.describe("reautorização de pagamento", () => {
  test("carrega a tela protegida sem expor formulário para token ausente", async ({ page }) => {
    await page.goto(`/reautorizar-pagamento/${ABSENT_TOKEN}`)
    await expect(page.locator("main")).toBeVisible()
    // Espera sair de "Validando seu link seguro…" antes de afirmar que não há formulário.
    await expect(page.getByText("Não foi possível continuar")).toBeVisible({ timeout: 15_000 })
    await expect(page.locator("form")).toHaveCount(0)
    await runResponsiveChecks(page)
  })
})
