import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { injectE2eAuthCookie } from "../../../fixtures/auth"
import { disconnectPrisma, getPrisma } from "../../../support/db"
import { runResponsiveChecks } from "../../../support/responsive"
import { signE2eJwt } from "../../../../lib/e2e/e2e-jwt"

const created = { backofficeProfileId: "", masterProfileId: "", teamId: "" }
let backofficeSupabaseId = ""
let backofficeEmail = ""
let masterName = ""
let teamName = ""

function uniqueEmail(prefix: string): string {
  return `${prefix}.${randomUUID()}@example.test`
}

test.describe("backoffice clients — master com perfil operator", () => {
  test.setTimeout(120_000)

  test.beforeAll(async () => {
    const prisma = getPrisma()
    const suffix = randomUUID().slice(0, 8)

    backofficeSupabaseId = randomUUID()
    backofficeEmail = uniqueEmail("e2e.backoffice.master-operator")
    const backofficeProfile = await prisma.profile.create({
      data: {
        supabaseId: backofficeSupabaseId,
        email: backofficeEmail,
        fullName: "E2E Backoffice Master Operator",
        role: "backoffice",
        isMaster: false,
      },
      select: { id: true, email: true },
    })
    created.backofficeProfileId = backofficeProfile.id

    await prisma.backofficeUser.create({
      data: {
        profileId: backofficeProfile.id,
        email: backofficeProfile.email,
        fullAccess: true,
        isActive: true,
      },
    })

    masterName = `E2E Master Operator ${suffix}`
    const master = await prisma.profile.create({
      data: {
        email: uniqueEmail("e2e.master.operator-profile"),
        fullName: masterName,
        role: "operator",
        isMaster: true,
      },
      select: { id: true },
    })
    created.masterProfileId = master.id

    teamName = `E2E Ventura Studio ${suffix}`
    const team = await prisma.team.create({
      data: { name: teamName, masterId: master.id, isDefault: true },
      select: { id: true },
    })
    created.teamId = team.id

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        profileId: master.id,
        role: "manager",
        functions: [],
      },
    })
  })

  test.afterAll(async () => {
    const prisma = getPrisma()
    if (created.teamId) {
      await prisma.teamMember.deleteMany({ where: { teamId: created.teamId } }).catch(() => null)
      await prisma.team.deleteMany({ where: { id: created.teamId } }).catch(() => null)
    }
    if (created.masterProfileId) {
      await prisma.profile.deleteMany({ where: { id: created.masterProfileId } }).catch(() => null)
    }
    if (created.backofficeProfileId) {
      await prisma.backofficeUser.deleteMany({ where: { profileId: created.backofficeProfileId } }).catch(() => null)
      await prisma.profile.deleteMany({ where: { id: created.backofficeProfileId } }).catch(() => null)
    }
    await disconnectPrisma()
  })

  test.beforeEach(async ({ context, baseURL }) => {
    const token = signE2eJwt({ supabaseId: backofficeSupabaseId, email: backofficeEmail })
    await injectE2eAuthCookie(context, {
      token,
      baseUrl: baseURL ?? "http://127.0.0.1:3000",
    })
  })

  test("encontra o master ao buscar pelo nome do time", async ({ page }) => {
    await page.goto("/backoffice/clients")
    const search = page.getByPlaceholder("Buscar por nome/e-mail de usuário ou nome do time")
    const searchResponse = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname.endsWith("/backoffice/clients") && url.searchParams.get("q") === teamName
    })
    await search.fill(teamName)
    expect((await searchResponse).status()).toBe(200)

    const visualizaLink = page.locator(`a[href^="/backoffice/clients/${created.masterProfileId}?"]`)
    await expect(visualizaLink).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(masterName, { exact: true })).toBeVisible()
    await expect(visualizaLink).toHaveAttribute(
      "href",
      new RegExp(`^/backoffice/clients/${created.masterProfileId}\\?`),
    )

    await runResponsiveChecks(page)
  })
})
