/**
 * app/[supabaseId]/email/campanhas/page.tsx
 *
 * Cobertura PR6: página carrega; copy do AlertDialog de cancelar envio.
 * Bounce/wizard da audiência ficam no PR7 — não duplicar aqui.
 */

import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import {
  CAMPAIGN_CANCEL_SENDING_ACCEPTED_COPY,
  CAMPAIGN_CANCEL_SENDING_UNSENT_COPY,
} from "@/lib/email/campaign-dispatch-copy"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids"
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db"

async function grantEmailCampaignsBeta(profileId: string) {
  const prisma = getPrisma()
  for (const slug of [FEATURE_SLUGS.EMAIL, FEATURE_SLUGS.EMAIL_CAMPAIGNS]) {
    const feature = await prisma.backofficeFeature.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!feature) {
      throw new Error(`Feature ${slug} ausente no catálogo — rode \`bun run db:seed:e2e\``)
    }

    await prisma.backofficeFeatureGrant.upsert({
      where: {
        featureId_profileId_grantType: {
          featureId: feature.id,
          profileId,
          grantType: "BETA",
        },
      },
      create: {
        featureId: feature.id,
        profileId,
        grantType: "BETA",
        isActive: true,
        betaTeamScope: "ALL_TEAMS",
      },
      update: {
        isActive: true,
        betaTeamScope: "ALL_TEAMS",
      },
    })
  }
}

test.describe("app/[supabaseId]/email/campanhas", () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ context }) => {
    const profile = await findE2eMasterProfile()
    expect(profile, "Seed E2E ausente — rode `bun run db:seed:e2e`").not.toBeNull()
    await grantEmailCampaignsBeta(profile!.id)
    await injectE2eAuthCookie(context)
    await context.addInitScript((supabaseId: string) => {
      window.localStorage.setItem(`whats-new:seen:v1:${supabaseId}`, "true")
    }, E2E_MASTER_SUPABASE_ID)
  })

  test.afterAll(async () => {
    await disconnectPrisma()
  })

  test("carrega sem erro e mostra o heading Campanhas", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/campanhas`, {
      waitUntil: "domcontentloaded",
    })
    await expect(page.locator("h1.text-2xl", { hasText: "Campanhas" })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText("Acesso não liberado")).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Nova Campanha/i })).toBeVisible()
  })

  test("AlertDialog de cancelar envio avisa que não enviados não saem", async ({ page }) => {
    const profile = await findE2eMasterProfile()
    if (!profile?.activeTeamId) {
      throw new Error("Seed E2E sem time ativo")
    }

    const prisma = getPrisma()
    const templateId = randomUUID()
    const campaignId = randomUUID()
    await prisma.emailTemplate.create({
      data: {
        id: templateId,
        versionGroupId: templateId,
        teamId: profile.activeTeamId,
        createdBy: profile.id,
        name: "E2E cancel copy",
        subject: "Assunto E2E",
        html: "<p>Olá</p>",
        status: "published",
        versionNumber: 1,
      },
    })
    await prisma.emailCampaign.create({
      data: {
        id: campaignId,
        teamId: profile.activeTeamId,
        createdBy: profile.id,
        name: "E2E Cancelar Envio",
        templateId,
        status: "sending",
        totalRecipients: 10,
      },
    })

    try {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/campanhas`, {
        waitUntil: "domcontentloaded",
      })
      const campaignRow = page.getByRole("row").filter({ hasText: "E2E Cancelar Envio" })
      await expect(campaignRow).toBeVisible({ timeout: 30_000 })
      const menuButton = campaignRow.getByRole("button", { name: "Abrir menu" })
      await menuButton.scrollIntoViewIfNeeded()
      await menuButton.click()
      await page.getByRole("menuitem", { name: "Cancelar envio" }).click()
      await expect(page.getByRole("alertdialog")).toBeVisible()
      await expect(page.getByText(CAMPAIGN_CANCEL_SENDING_UNSENT_COPY)).toBeVisible()
      await expect(page.getByText(CAMPAIGN_CANCEL_SENDING_ACCEPTED_COPY)).toBeVisible()
    } finally {
      await prisma.emailCampaign.delete({ where: { id: campaignId } }).catch(() => {})
      await prisma.emailTemplate.delete({ where: { id: templateId } }).catch(() => {})
    }
  })
})
