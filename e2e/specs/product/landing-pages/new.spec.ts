import { expect, test } from "@playwright/test"
import { injectE2eAuthCookie } from "../../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../../support/e2e-ids"
import { runResponsiveChecks } from "../../../support/responsive"

test.describe("wizard de landing pages de cotação", () => {
  test("carrega o wizard sem overflow, com touch targets e reduced-motion", async ({ context, page }) => {
    await injectE2eAuthCookie(context)
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/landing-pages/new`)
    await expect(page.locator("main")).toBeVisible()
    await runResponsiveChecks(page)
  })
})
