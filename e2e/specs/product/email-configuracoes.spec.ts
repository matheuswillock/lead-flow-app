import { expect, test } from "@playwright/test"
import { injectE2eAuthCookie } from "../../fixtures/auth"
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids"
import { disconnectPrisma, findE2eMasterProfile } from "../../support/db"

test.describe("app/[supabaseId]/email/configuracoes", () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ context }) => {
    const profile = await findE2eMasterProfile()
    expect(profile, "Seed E2E ausente — rode `bun run db:seed:e2e`").not.toBeNull()
    await injectE2eAuthCookie(context)
  })

  test.afterAll(async () => {
    await disconnectPrisma()
  })

  test("carrega configurações de e-mail autenticado", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/email/configuracoes`, {
      waitUntil: "domcontentloaded",
    })
    await expect(page.getByRole("heading", { name: "Configurações de E-mail" })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText("Acesso não liberado")).toHaveCount(0)
  })
})
