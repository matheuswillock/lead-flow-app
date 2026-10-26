import { expect, test } from "@playwright/test"
import { runResponsiveChecks } from "../../../support/responsive"

test("landing de conversão inexistente não é servida", async ({ request, page }) => {
  const path = "/conversao/00000000-0000-4000-8000-000000000000"
  const response = await request.get(path)
  expect(response.status()).toBe(200)
  await page.goto(path)
  await expect(page.locator("body")).toContainText("404")
  await runResponsiveChecks(page)
})
