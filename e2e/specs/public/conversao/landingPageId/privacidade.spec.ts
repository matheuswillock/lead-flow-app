import { test, expect } from '@playwright/test'

test('privacidade pública da landing', async ({ page }) => {
  const landingPageId = process.env.E2E_PUBLIC_LANDING_PAGE_ID
  test.skip(!landingPageId, 'E2E_PUBLIC_LANDING_PAGE_ID não configurado')
  await page.goto('/conversao/' + landingPageId + '/privacidade')
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth + 1))
})
