import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { injectE2eAuthCookie } from "../../../fixtures/auth"
import { E2E_LANDING_FIXTURES, type LandingFixture } from "../../../support/landing-pages"
import { runResponsiveChecks } from "../../../support/responsive"

/**
 * Fluxo completo de uma landing de template: abre a LP vinda de e-mail, preenche
 * o formulário publicado e confirma o envio. A landing vem do globalSetup
 * (e2e/global-setup.ts).
 *
 * Os templates importados (`black-and-white`, `alvora`) não têm o
 * `data-template` do renderer padrão: a raiz é `main#top` e a prova de que o
 * template certo renderizou é o nome da marca do fixture. O formulário aparece
 * mais de uma vez na página (versão compacta e completa), então os locators
 * pegam só o que está visível.
 */
async function submitLeadThroughLanding(context: BrowserContext, page: Page, fixture: LandingFixture) {
  await injectE2eAuthCookie(context)
  await page.addInitScript(() => localStorage.setItem("sua-marca-cookie-consent", "all"))
  await page.goto(
    `/conversao/${fixture.publicId}?utm_source=email&utm_campaign=e2e-campaign&cs_el=e2e-email-log`,
    { waitUntil: "domcontentloaded" },
  )

  await expect(page.locator("main#top")).toBeVisible()
  await expect(page.getByText(fixture.brandName).first()).toBeVisible()
  await page.getByRole("link").filter({ hasText: /comparar|analisar|começar|entender/i }).first().click()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

  const form = page.locator("#landing-form form:visible").first()
  await expect(form).toBeVisible()
  for (const input of await form.locator("input").all()) {
    const inputType = await input.getAttribute("type")
    if (inputType === "email") await input.fill("lead.e2e@example.com")
    else if (inputType === "tel") await input.fill("11987654321")
    else if (inputType !== "checkbox" && inputType !== "date" && inputType !== "time") await input.fill("Lead E2E")
  }
  await form.getByRole("button").last().click()

  await expect(
    page.locator("#landing-form:visible").filter({ hasText: /respostas|recebemos|enviad/i }).first(),
  ).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(500)
  await runResponsiveChecks(page)
}

test("black-and-white: e-mail → LP → formulário → lead → Radar", async ({ context, page }) => {
  await submitLeadThroughLanding(context, page, E2E_LANDING_FIXTURES.blackAndWhite)
})

test("alvora: e-mail → LP → consentimento → formulário → lead → Radar", async ({ context, page }) => {
  await submitLeadThroughLanding(context, page, E2E_LANDING_FIXTURES.alvora)
})
