/**
 * app/[supabaseId]/email/campanhas/page.tsx
 *
 * Cobertura PR7: página carrega; wizard subtrai bounce permanente e avisa.
 * Cancelar envio (AlertDialog) fica no PR6 — não duplicar aqui.
 */

import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { formatPermanentBounceAlert } from "@/lib/email/campaign-audience-copy"
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

  test("wizard avisa bounce permanente e subtrai da audiência", async ({ page }) => {
    const profile = await findE2eMasterProfile()
    if (!profile?.activeTeamId) {
      throw new Error("Seed E2E sem time ativo")
    }

    const prisma = getPrisma()
    const templateId = randomUUID()
    const listId = randomUUID()
    const listName = "E2E Bounce Permanente"
    const templateName = "E2E Template Bounce"

    await prisma.emailTemplate.create({
      data: {
        id: templateId,
        versionGroupId: templateId,
        teamId: profile.activeTeamId,
        createdBy: profile.id,
        name: templateName,
        subject: "Assunto E2E bounce",
        html: "<p>Olá</p>",
        status: "published",
        isCurrentPublished: true,
        approvalStatus: "approved",
        publishedAt: new Date(),
        versionNumber: 1,
      },
    })
    await prisma.emailContactList.create({
      data: {
        id: listId,
        teamId: profile.activeTeamId,
        createdBy: profile.id,
        name: listName,
        totalContacts: 5,
      },
    })
    await prisma.emailContact.createMany({
      data: [
        { listId, email: "ativo-a@e2e.bounce.test", name: "Ativo A" },
        { listId, email: "ativo-b@e2e.bounce.test", name: "Ativo B" },
        { listId, email: "bounce-a@e2e.bounce.test", name: "Bounce A", isBounced: true },
        { listId, email: "bounce-b@e2e.bounce.test", name: "Bounce B", isBounced: true },
        { listId, email: "bounce-c@e2e.bounce.test", name: "Bounce C", isBounced: true },
      ],
    })

    try {
      await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/campanhas`, {
        waitUntil: "domcontentloaded",
      })
      await expect(page.getByRole("button", { name: /Nova Campanha/i })).toBeVisible({
        timeout: 30_000,
      })
      await page.getByRole("button", { name: /Nova Campanha/i }).click()
      await expect(page.getByRole("dialog")).toBeVisible()

      await page.getByLabel("Nome da campanha *").fill("E2E Campanha Bounce")
      await page.getByRole("button", { name: "Próxima" }).click()

      await expect(page.getByText(listName, { exact: false })).toBeVisible()
      await page.getByText(listName, { exact: false }).click()
      await page.getByRole("button", { name: "Próxima" }).click()

      await page.getByRole("combobox").click()
      await page.getByRole("option", { name: templateName }).click()
      await page.getByRole("button", { name: "Próxima" }).click()

      await expect(page.getByText(formatPermanentBounceAlert(3))).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByText("Total: 2 destinatários")).toBeVisible()
      await expect(page.getByText("3 bounce permanente")).toBeVisible()
    } finally {
      await prisma.emailContact.deleteMany({ where: { listId } }).catch(() => {})
      await prisma.emailContactList.delete({ where: { id: listId } }).catch(() => {})
      await prisma.emailTemplate.delete({ where: { id: templateId } }).catch(() => {})
    }
  })
})
