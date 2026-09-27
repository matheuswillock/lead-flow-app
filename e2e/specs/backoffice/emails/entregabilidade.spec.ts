import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { injectE2eAuthCookie } from "../../../fixtures/auth"
import { disconnectPrisma, getPrisma } from "../../../support/db"
import { runResponsiveChecks } from "../../../support/responsive"

test.describe("app/backoffice/(app)/emails/entregabilidade", () => {
  const supabaseId = randomUUID()
  const email = `e2e.backoffice.deliverability.${Date.now()}@example.com`
  let profileId = ""

  test.beforeAll(async () => {
    const profile = await getPrisma().profile.create({ data: { supabaseId, email, fullName: "E2E Deliverability", role: "backoffice" } })
    profileId = profile.id
    await getPrisma().backofficeUser.create({ data: { profileId, email, fullAccess: true, isActive: true } })
  })

  test.afterAll(async () => {
    if (profileId) await getPrisma().profile.delete({ where: { id: profileId } }).catch(() => {})
    await disconnectPrisma()
  })

  test("mostra times em atenção sem overflow mobile", async ({ context, page }, testInfo) => {
    await injectE2eAuthCookie(context, { supabaseId, email })
    await page.route(/\/backoffice\/email-deliverability(?:\?|$)/, async (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ isValid: true, result: { teams: [{ teamId: randomUUID(), teamName: "Time E2E", sent: 100, delivered: 90, bounced: 8, complained: 1, deliveryRate: 0.9, bounceRate: 0.08, complaintRate: 0.01 }] } }),
    }))
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto("/backoffice/emails/entregabilidade", { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: "Entrega e reputação" })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("Time E2E")).toBeVisible()
    await expect(page.getByText("Atenção", { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("backoffice-deliverability-360.png"), fullPage: true })
    await runResponsiveChecks(page, {
      touchTargets: { selector: 'a[href]:not(.sr-only), button, [role="button"]' },
      reducedMotion: { ignoreSelector: ".lucide-loader-circle" },
    })
  })
})
