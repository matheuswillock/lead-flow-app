/**
 * app/[supabaseId]/email/contatos/page.tsx
 *
 * Gate de validação na importação (reputação de envio):
 * - relatório da importação com veredito por categoria + risco;
 * - lista quarentenada por risco ALTO exibe banner e some após liberação
 *   explícita (manager/owner) com confirmação do custo de reputação.
 */

import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { WHATS_NEW_VERSION } from "@/components/whats-new-modal"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids"
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db"
import { runResponsiveChecks } from "../../support/responsive"

test.describe("app/[supabaseId]/email/contatos", () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ context }) => {
    const profile = await findE2eMasterProfile()
    expect(profile, "Seed E2E ausente — rode `bun run db:seed:e2e`").not.toBeNull()
    await injectE2eAuthCookie(context)
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
      },
      { supabaseId: E2E_MASTER_SUPABASE_ID, version: WHATS_NEW_VERSION }
    )
  })

  test.afterAll(async () => {
    await disconnectPrisma()
  })

  test("carrega sem erro, mostra o heading e é responsiva", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/contatos`, {
      waitUntil: "domcontentloaded",
    })
    await expect(page.locator("h1.text-2xl", { hasText: "Contatos" })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole("button", { name: /Nova Lista/i })).toBeVisible()

    // Recarrega a página no passo de reduced-motion — sempre por último.
    await runResponsiveChecks(page)
  })

  test("lista suja: veredito por categoria, quarentena e liberação explícita", async ({
    page,
  }) => {
    const profile = await findE2eMasterProfile()
    if (!profile?.activeTeamId) {
      throw new Error("Seed E2E sem time ativo")
    }

    const prisma = getPrisma()
    const listId = randomUUID()
    const jobId = randomUUID()
    const importId = `e2e-gate-${randomUUID().slice(0, 8)}`
    const listName = `E2E Lista Suja ${importId}`
    const quarantineReason =
      `Importação ${importId} com risco ALTO — 87 removidos (43 supressão (bounce), 22 sem MX, 12 descartáveis, 10 duplicados).`

    await prisma.emailContactList.create({
      data: {
        id: listId,
        teamId: profile.activeTeamId,
        createdBy: profile.id,
        name: listName,
        totalContacts: 3,
        isQuarantined: true,
        quarantinedAt: new Date(),
        quarantineReason,
      },
    })
    await prisma.emailContact.createMany({
      data: [
        { listId, email: "valido-a@e2e.gate.test", name: "Válido A" },
        { listId, email: "valido-b@e2e.gate.test", name: "Válido B" },
        { listId, email: "valido-c@e2e.gate.test", name: "Válido C" },
      ],
    })
    await prisma.emailImportJob.create({
      data: {
        id: jobId,
        importId,
        teamId: profile.activeTeamId,
        listId,
        requestedBy: profile.id,
        sourceFormat: "csv",
        storagePath: `e2e/${importId}.csv`,
        status: "completed",
        totalRows: 100,
        processedRows: 100,
        importedCount: 10,
        updatedCount: 3,
        skippedCount: 77,
        batchSize: 500,
        riskLevel: "high",
        validationCounts: {
          suppressedBounce: 43,
          noMxDomain: 22,
          disposableDomain: 12,
          duplicate: 10,
        },
      },
    })

    try {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/contatos`, {
        waitUntil: "domcontentloaded",
      })

      // Seleciona a lista quarentenada no painel lateral.
      await page.getByRole("button", { name: new RegExp(listName) }).first().click()

      // Banner de quarentena com o motivo do gate.
      const banner = page.getByTestId("quarantine-banner")
      await expect(banner).toBeVisible({ timeout: 30_000 })
      await expect(banner).toContainText("quarentena")
      await expect(banner).toContainText("risco ALTO")

      // Veredito por categoria + risco no relatório da importação.
      const verdictLine = page.getByTestId("import-verdict-line")
      await expect(verdictLine).toBeVisible({ timeout: 30_000 })
      await expect(verdictLine).toContainText("13 válidos")
      await expect(verdictLine).toContainText("87 removidos")
      await expect(verdictLine).toContainText("43 supressão (bounce)")
      await expect(verdictLine).toContainText("22 sem MX")
      await expect(verdictLine).toContainText("12 descartáveis")
      await expect(verdictLine).toContainText("10 duplicados")
      await expect(verdictLine).toContainText("risco: ALTO")

      // Liberação explícita: AlertDialog com o aviso do custo de reputação.
      await page.getByTestId("quarantine-release-trigger").click()
      const dialog = page.getByRole("alertdialog")
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText("reputação")
      await page.getByTestId("quarantine-release-confirm").click()

      // Banner some e o banco reflete a liberação, com autor registrado.
      await expect(page.getByTestId("quarantine-banner")).toHaveCount(0, {
        timeout: 30_000,
      })
      await expect
        .poll(
          async () => {
            const released = await prisma.emailContactList.findUnique({
              where: { id: listId },
              select: { isQuarantined: true, quarantineReleasedBy: true },
            })
            return released?.isQuarantined === false && released?.quarantineReleasedBy != null
          },
          { timeout: 15_000 }
        )
        .toBe(true)
    } finally {
      await prisma.emailImportJob.delete({ where: { id: jobId } }).catch(() => {})
      await prisma.emailContact.deleteMany({ where: { listId } }).catch(() => {})
      await prisma.emailContactList.delete({ where: { id: listId } }).catch(() => {})
    }
  })
})
