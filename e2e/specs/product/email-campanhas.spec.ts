/**
 * app/[supabaseId]/email/campanhas/page.tsx
 *
 * PR6: copy do AlertDialog de cancelar envio.
 * develop/PR7: wizard subtrai bounce permanente e avisa.
 */

import { randomUUID } from "node:crypto"
import { expect, test, type Page, type Request } from "@playwright/test"
import { formatPermanentBounceAlert } from "@/lib/email/campaign-audience-copy"
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

  /**
   * Cadência do polling de progresso de disparo.
   *
   * O provider vive no layout autenticado, então o intervalo roda em qualquer
   * rota. Estes testes contam requisições reais em vez de julgar o código: é a
   * única forma de provar que o caso ocioso caiu sem estragar o caso de disparo.
   */
  test.describe("cadência do polling de dispatch", () => {
    /** Conta hits em /email/campaigns durante uma janela. */
    async function countCampaignPolls(page: Page, windowMs: number): Promise<number> {
      let hits = 0
      const onRequest = (request: Request) => {
        if (request.url().includes("/email/campaigns")) hits += 1
      }
      page.on("request", onRequest)
      await page.waitForTimeout(windowMs)
      page.off("request", onRequest)
      return hits
    }

    test("aba oculta não dispara polling", async ({ page }) => {
      await page.goto(`/${E2E_MASTER_SUPABASE_ID}/board`, { waitUntil: "domcontentloaded" })
      await page.waitForTimeout(2_000)

      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        })
        document.dispatchEvent(new Event("visibilitychange"))
      })

      const hits = await countCampaignPolls(page, 10_000)
      expect(hits, "aba oculta não deve consultar campanhas").toBe(0)
    })

    test("fora do módulo de e-mail e sem disparo, a cadência é baixa", async ({ page }) => {
      // /board não tem relação com e-mail; antes desta mudança o intervalo de 4s
      // rodava aqui do mesmo jeito, gerando ~15 requisições por minuto.
      await page.goto(`/${E2E_MASTER_SUPABASE_ID}/board`, { waitUntil: "domcontentloaded" })
      await page.waitForTimeout(3_000)

      const hits = await countCampaignPolls(page, 12_000)
      expect(hits, `esperado no máximo 1 hit em 12s, veio ${hits}`).toBeLessThanOrEqual(1)
    })
  })
})
