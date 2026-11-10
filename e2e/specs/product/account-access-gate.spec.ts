import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { disconnectPrisma, getPrisma } from "../../support/db"
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal"
import { runResponsiveChecks } from "../../support/responsive"

test.describe.serial("gate de acesso da conta", () => {
  const isolatedSupabaseId = randomUUID()
  const isolatedEmail = `e2e.account-access.${randomUUID()}@example.com`
  let isolatedProfileId: string
  let allowedMasterProfileId: string
  let allowedTeamName: string

  test.beforeAll(async () => {
    const prisma = getPrisma()
    const profile = await prisma.profile.create({
      data: {
        email: isolatedEmail,
        supabaseId: isolatedSupabaseId,
        fullName: "E2E Account Access",
        isMaster: true,
        subscriptionStatus: "past_due",
      },
    })
    isolatedProfileId = profile.id

    const team = await prisma.team.create({
      data: { name: `E2E Account Access ${isolatedSupabaseId.slice(0, 8)}`, masterId: profile.id },
    })
    await prisma.teamMember.create({
      data: { teamId: team.id, profileId: profile.id, role: "manager" },
    })
    await prisma.profile.update({ where: { id: profile.id }, data: { activeTeamId: team.id } })
    await prisma.profileSubscription.create({
      data: { profileId: profile.id, subscriptionStatus: "past_due" },
    })

    const allowedMaster = await prisma.profile.create({
      data: {
        email: `e2e.account-access.allowed.${randomUUID()}@example.com`,
        fullName: "E2E Account Access Allowed",
        isMaster: true,
        hasPermanentSubscription: true,
      },
    })
    allowedMasterProfileId = allowedMaster.id
    allowedTeamName = `E2E Account Access Allowed ${isolatedSupabaseId.slice(0, 8)}`
    const allowedTeam = await prisma.team.create({
      data: { name: allowedTeamName, masterId: allowedMaster.id },
    })
    await prisma.teamMember.create({
      data: { teamId: allowedTeam.id, profileId: profile.id, role: "manager" },
    })
  })

  test.afterAll(async () => {
    const prisma = getPrisma()
    await prisma.profile.delete({ where: { id: isolatedProfileId } })
    await prisma.profile.delete({ where: { id: allowedMasterProfileId } })
    await disconnectPrisma()
  })

  test("em 360px mantém o menu restrito para trocar de time ou sair, sem expor conteúdo", async ({ context, page }) => {
    await injectE2eAuthCookie(context, { supabaseId: isolatedSupabaseId, email: isolatedEmail })
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true")
      },
      { supabaseId: isolatedSupabaseId, version: WHATS_NEW_VERSION }
    )
    await page.setViewportSize({ width: 360, height: 800 })

    await page.goto(`/${isolatedSupabaseId}/dashboard`, { waitUntil: "domcontentloaded" })

    await expect(page.getByRole("heading", { name: "Seu acesso está pausado" })).toBeVisible({
      timeout: 30_000,
    })
    // O master (quem paga) tem uma única ação: reativar pela renovação.
    const reactivateLink = page.getByRole("link", { name: "Reativar assinatura" })
    await expect(reactivateLink).toHaveAttribute("href", `/${isolatedSupabaseId}/billing-grace-payment`)
    await expect(page.getByRole("link", { name: /Fale com o time de assinaturas/ })).toHaveCount(0)
    await expect(page.getByRole("link")).toHaveCount(1)

    await page.getByRole("button", { name: "Abrir menu de acesso" }).click()
    const restrictedSidebar = page.getByTestId("restricted-access-sidebar")
    await expect(restrictedSidebar).toBeVisible()
    await expect(restrictedSidebar.getByText("Trocar de time")).toBeVisible()
    await expect(restrictedSidebar.getByRole("button", { name: "Sair" })).toBeVisible()

    await restrictedSidebar.getByRole("button", { name: /E2E Account Access/ }).click()
    await page.getByRole("option", { name: new RegExp(allowedTeamName) }).click()

    await expect(page.getByRole("heading", { name: "Seu acesso está pausado" })).toHaveCount(0)
    await expect(page.locator("header")).toHaveCount(1)
    await expect(page.getByText("Próximas Reuniões")).toHaveCount(0)
    await expect(page.getByText("CRM", { exact: true })).toHaveCount(0)

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1)
    await runResponsiveChecks(page)
  })
})
