import { expect, test } from "@playwright/test"
import { assertReducedMotion, runResponsiveChecks } from "../../../support/responsive"

test("landing inexistente não é servida", async ({ request, page }) => {
  const path = "/conversation/00000000-0000-4000-8000-000000000000"
  const response = await request.get(path)
  // Com cacheComponents/PPR, o shell inicial mantém status 200 e o notFound
  // é materializado no corpo durante o streaming.
  expect(response.status()).toBe(200)
  await page.goto(path)
  await expect(page.locator("body")).toContainText("404")
  await runResponsiveChecks(page)
})

test("reduced-motion não espera recursos de imagem travados", async ({ page }) => {
  await page.setDefaultNavigationTimeout(2_000)
  await page.route("**/blocked-test-image.png", async () => {})
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const image = document.createElement("img")
      image.src = "/blocked-test-image.png"
      document.body.append(image)
    })
  })

  await page.goto("/conversation/00000000-0000-4000-8000-000000000000", {
    waitUntil: "domcontentloaded",
  })
  await assertReducedMotion(page)
})
