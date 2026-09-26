import { test } from "@playwright/test"
import { runResponsiveChecks } from "../../support/responsive"

test.describe("gerenciamento de landing pages", () => {
  test("mantém a página sem overflow em viewport mobile", async ({ page }) => {
    await page.goto("/landing-pages")
    await runResponsiveChecks(page)
  })
})
