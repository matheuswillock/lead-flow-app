import { expect, test } from "@playwright/test"
import { WHATS_NEW_VERSION } from "@/components/whats-new-modal"
import { injectE2eAuthCookie } from "../../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../../support/e2e-ids"
import { runResponsiveChecks } from "../../../support/responsive"

test("analytics de landing pages abre e é responsivo", async ({ context, page }) => {
  await injectE2eAuthCookie(context)
  await context.addInitScript(({ id, version }) => localStorage.setItem(`whats-new:seen:${version}:${id}`, "true"), { id: E2E_MASTER_SUPABASE_ID, version: WHATS_NEW_VERSION })
  await page.goto(`/${E2E_MASTER_SUPABASE_ID}/landing-pages/analytics`, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: "Analytics das landing pages" })).toBeVisible()
  await runResponsiveChecks(page)
})
