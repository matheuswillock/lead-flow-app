import { expect, test } from "@playwright/test"
import { runResponsiveChecks } from "../../support/responsive"

test.describe("app/page", () => {
  test("carrega a landing e mantém o Header com hierarquia comercial", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /ALTA PERFORMANCE/i })).toBeVisible()
    const cookieAcceptButton = page.getByRole("button", { name: "Aceitar" })
    await expect(cookieAcceptButton).toBeVisible()
    await expect(cookieAcceptButton).toHaveCSS("color", "rgb(255, 255, 255)")

    const header = page.locator("header")
    await expect(header.getByRole("link", { name: "Produto" })).toHaveAttribute("href", "/#produto")
    await expect(header.getByRole("link", { name: "Recursos" })).toHaveAttribute("href", "/#crm")
    await expect(header.getByRole("link", { name: "Como funciona" })).toHaveAttribute(
      "href",
      "/#como",
    )
    await expect(header.getByText("Preços", { exact: true })).toBeVisible()
    await expect(header.getByRole("link", { name: "Dúvidas" })).toHaveAttribute("href", "/#faq")
    await expect(header.getByRole("link", { name: "Entrar na conta" })).toHaveAttribute(
      "href",
      "/sign-in",
    )
    await header.getByRole("button", { name: "Solicitar demonstração" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
    const primaryAction = header.getByRole("button", { name: /Começar agora/ })
    await expect(primaryAction).toBeDisabled()
    await expect(primaryAction).toHaveCSS("color", "rgb(255, 255, 255)")
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }))
    await expect
      .poll(() => header.evaluate((element) => Math.round(element.getBoundingClientRect().top)))
      .toBe(0)

    await page.setViewportSize({ width: 390, height: 844 })
    const mobileLogo = header.getByRole("link", { name: "Corretor Studio" })
    const mobileMenuButton = page.getByRole("button", { name: "Abrir menu de navegação" })
    await expect(mobileLogo).toBeVisible()
    await expect
      .poll(async () => {
        const logoBox = await mobileLogo.boundingBox()
        const menuBox = await mobileMenuButton.boundingBox()
        return logoBox && menuBox ? logoBox.x + logoBox.width < menuBox.x : false
      })
      .toBe(true)
    await mobileMenuButton.click()
    const mobileMenu = page.getByRole("dialog")
    await expect(mobileMenu.getByRole("link", { name: "Produto" })).toBeVisible()
    await expect(mobileMenu.getByRole("link", { name: "Recursos" })).toBeVisible()
    await expect(mobileMenu.getByRole("link", { name: "Como funciona" })).toBeVisible()
    await expect(mobileMenu.getByText("Preços", { exact: true })).toBeVisible()
    await expect(mobileMenu.getByRole("link", { name: "Dúvidas" })).toBeVisible()
    await expect(mobileMenu.getByRole("link", { name: "Entrar na conta" })).toBeVisible()
    await expect(mobileMenu.getByRole("button", { name: "Solicitar demonstração" })).toBeVisible()
    await expect(mobileMenu.getByRole("button", { name: /Começar agora/ })).toBeDisabled()
    await page.keyboard.press("Escape")
    await expect(mobileMenu).toBeHidden()

    await runResponsiveChecks(page, {
      touchTargets: { selector: "header a[href], header button" },
    })
  })
})
