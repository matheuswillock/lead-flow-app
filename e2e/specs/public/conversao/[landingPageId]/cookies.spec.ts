import { expect, test } from "@playwright/test"
import { runResponsiveChecks } from "../../../support/responsive"

test("rota cookies rejeita landing inexistente", async ({ request, page }) => {
  const path = "/conversao/00000000-0000-4000-8000-000000000000/cookies"
  const response = await request.get(path)
  expect(response.status()).toBe(404)
  await page.goto(path)
  await runResponsiveChecks(page)
})
