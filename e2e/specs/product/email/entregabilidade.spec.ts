import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { WHATS_NEW_VERSION } from "@/components/whats-new-modal"
import { injectE2eAuthCookie } from "../../../fixtures/auth"
import { disconnectPrisma, getPrisma } from "../../../support/db"
import { trackPageNoise } from "../../../support/console-noise"
import { runResponsiveChecks } from "../../../support/responsive"

test.describe("app/[supabaseId]/email/entregabilidade", () => {
  const supabaseId = randomUUID()
  const email = `e2e.product.deliverability.${Date.now()}@example.com`
  let profileId = ""

  test.beforeAll(async () => {
    const profile = await getPrisma().profile.create({
      data: {
        supabaseId,
        email,
        fullName: "E2E Deliverability",
        role: "manager",
        isMaster: true,
        hasPermanentSubscription: true,
      },
    })
    profileId = profile.id
    const team = await getPrisma().team.create({
      data: { name: "Time E2E Deliverability", masterId: profile.id, isDefault: true },
    })
    await getPrisma().teamMember.create({
      data: { teamId: team.id, profileId: profile.id, role: "manager" },
    })
    await getPrisma().profile.update({
      where: { id: profile.id },
      data: { activeTeamId: team.id },
    })
    const feature = await getPrisma().backofficeFeature.findUnique({
      where: { slug: "email-campaigns" },
      select: { id: true },
    })
    if (!feature) throw new Error("Feature email-campaigns ausente no catálogo E2E")
    await getPrisma().backofficeFeatureGrant.create({
      data: {
        featureId: feature.id,
        profileId: profile.id,
        grantType: "BETA",
        isActive: true,
        betaTeamScope: "ALL_TEAMS",
      },
    })
  })

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context, { supabaseId, email })
    await context.addInitScript(
      ({ supabaseId, version }) => localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true"),
      { supabaseId, version: WHATS_NEW_VERSION }
    )
  })

  test.afterAll(async () => {
    if (profileId) await getPrisma().profile.delete({ where: { id: profileId } }).catch(() => {})
    await disconnectPrisma()
  })

  test("renderiza métricas, filtros e mantém 360px sem overflow", async ({ page }, testInfo) => {
    const { consoleErrors, failedRequests } = trackPageNoise(page)
    await page.route(/\/email\/analytics\/deliverability(?:\?|$)/, async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ isValid: true, result: {
          summary: { sent: 100, delivered: 96, hardBounced: 2, softBounced: 1, complained: 0, humanOpened: 44, clicked: 12, suppressed: 3, deliveryRate: 0.96, bounceRate: 0.03, complaintRate: 0, humanOpenRate: 0.44, clickRate: 0.12 },
          series: [{ date: "2026-09-27", sent: 100, delivered: 96, hardBounced: 2, softBounced: 1, complained: 0, humanOpened: 44, clicked: 12, suppressed: 3, deliveryRate: 0.96, bounceRate: 0.03, complaintRate: 0, humanOpenRate: 0.44, clickRate: 0.12 }],
          domains: [],
          providers: [{ recipientProvider: "gmail", sent: 100, delivered: 96, hardBounced: 2, softBounced: 1, complained: 0, humanOpened: 44, clicked: 12, suppressed: 3, deliveryRate: 0.96, bounceRate: 0.03, complaintRate: 0, humanOpenRate: 0.44, clickRate: 0.12 }],
        } }),
      })
    })
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto(`/${supabaseId}/email/entregabilidade`, { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: "Entrega e reputação" })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("96%").first()).toBeVisible()
    await expect(page.getByRole("button", { name: "90 dias" })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("product-deliverability-360.png"), fullPage: true })
    expect(consoleErrors).toEqual([])
    expect(failedRequests).toEqual([])
    await runResponsiveChecks(page)
  })
})
