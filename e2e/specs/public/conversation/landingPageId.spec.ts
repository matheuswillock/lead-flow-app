import { expect, test } from "@playwright/test"
import { runResponsiveChecks } from "../../../support/responsive"

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
