import { expect, test } from "@playwright/test"
import { injectE2eAuthCookie } from "../../../fixtures/auth"
import { runResponsiveChecks } from "../../../support/responsive"

test("black-and-white: e-mail → LP → formulário → lead → Radar", async ({ context, page }) => {
  await injectE2eAuthCookie(context)
  const templateSlug = "black-and-white"
  const publicId = process.env.E2E_BLACK_AND_WHITE_LANDING_ID
  test.skip(!publicId, "Landing publicada ausente no seed E2E")

  await page.addInitScript(() => localStorage.setItem("sua-marca-cookie-consent", "all"))
  await page.goto(`/conversao/${publicId}?utm_source=email&utm_campaign=e2e-campaign&cs_el=e2e-email-log`, { waitUntil: "domcontentloaded" })
  await expect(page.locator(`[data-template="${templateSlug}"]`).or(page.locator(`.${templateSlug}-template`))).toBeVisible()
  await expect(page.locator("#landing-form")).toBeVisible()
  await page.getByRole("link").filter({ hasText: /comparar|analisar|começar|entender/i }).first().click()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(100)
  const form = page.locator("#landing-form form")
  for (const input of await form.locator("input").all()) {
    const inputType = await input.getAttribute("type")
    if (inputType === "email") await input.fill("lead.e2e@example.com")
    else if (inputType === "tel") await input.fill("11987654321")
    else if (inputType !== "checkbox" && inputType !== "date" && inputType !== "time") await input.fill("Lead E2E")
  }
  await page.getByRole("button").filter({ hasText: /começar|enviar|comparar|analisar/i }).last().click()
  await expect(page.locator("#landing-form")).toContainText(/respostas|recebemos|enviad/i, { timeout: 10_000 })
  await page.waitForTimeout(500)
  await runResponsiveChecks(page)

})

test("alvora: e-mail → LP → consentimento → formulário → lead → Radar", async ({ context, page }) => {
  await injectE2eAuthCookie(context)
  const templateSlug = "alvora"
  const publicId = process.env.E2E_ALVORA_LANDING_ID
  test.skip(!publicId, "Landing publicada ausente no seed E2E")

  await page.addInitScript(() => localStorage.setItem("sua-marca-cookie-consent", "all"))
  await page.goto(`/conversao/${publicId}?utm_source=email&utm_campaign=e2e-campaign&cs_el=e2e-email-log`, { waitUntil: "domcontentloaded" })
  await expect(page.locator(`[data-template="${templateSlug}"]`).or(page.locator(`.${templateSlug}-template`))).toBeVisible()
  await expect(page.locator("#landing-form")).toBeVisible()
  await page.getByRole("link").filter({ hasText: /comparar|analisar|começar|entender/i }).first().click()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(100)
  const form = page.locator("#landing-form form")
  for (const input of await form.locator("input").all()) {
    const inputType = await input.getAttribute("type")
    if (inputType === "email") await input.fill("lead.e2e@example.com")
    else if (inputType === "tel") await input.fill("11987654321")
    else if (inputType !== "checkbox" && inputType !== "date" && inputType !== "time") await input.fill("Lead E2E")
  }
  await page.getByRole("button").filter({ hasText: /começar|enviar|comparar|analisar/i }).last().click()
  await expect(page.locator("#landing-form")).toContainText(/respostas|recebemos|enviad/i, { timeout: 10_000 })
  await page.waitForTimeout(500)
  await runResponsiveChecks(page)

})
