import { expect, test } from "@playwright/test"
import { WHATS_NEW_VERSION } from "@/components/whats-new-modal"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids"
import { runResponsiveChecks } from "../../support/responsive"

test.describe("gerenciamento de landing pages", () => {
  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context)
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
      },
      { supabaseId: E2E_MASTER_SUPABASE_ID, version: WHATS_NEW_VERSION },
    )
  })

  test("mantém a página sem overflow em viewport mobile", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/landing-pages`, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: "Páginas de cotação" })).toBeVisible()
    await runResponsiveChecks(page)
  })
})
