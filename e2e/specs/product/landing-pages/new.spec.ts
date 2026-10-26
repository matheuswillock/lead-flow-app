import { test } from "@playwright/test"
import { runResponsiveChecks } from "../../../support/responsive"

test.describe("wizard de landing pages de cotação", () => {
  test.skip("cobertura funcional será executada com o seed de landing pages", async ({ page }) => {
    await page.goto("/landing-pages/new")
    await runResponsiveChecks(page)
  })
})
