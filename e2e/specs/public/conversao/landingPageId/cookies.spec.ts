import { test, expect } from '@playwright/test'
import { runResponsiveChecks } from '../../../../support/responsive'

test('cookies pública da landing', async ({ page }) => {
  const landingPageId = process.env.E2E_PUBLIC_LANDING_PAGE_ID
  test.skip(!landingPageId, 'E2E_PUBLIC_LANDING_PAGE_ID não configurado')
  await page.goto('/conversao/' + landingPageId + '/cookies')
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth + 1))
  await runResponsiveChecks(page)
})
