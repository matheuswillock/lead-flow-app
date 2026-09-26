import { expect, test } from "@playwright/test"
import { runResponsiveChecks } from "../../../support/responsive"

test("landing inexistente não é servida", async ({ request, page }) => {
  const path = "/conversation/00000000-0000-4000-8000-000000000000"
  const response = await request.get(path)
  expect(response.status()).toBe(404)
  await page.goto(path)
  await runResponsiveChecks(page)
})
