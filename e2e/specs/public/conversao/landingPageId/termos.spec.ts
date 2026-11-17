import { test, expect } from '@playwright/test'
import { E2E_LANDING_FIXTURES } from '../../../../support/landing-pages'
import { runResponsiveChecks } from '../../../../support/responsive'

// A landing publicada vem do globalSetup (e2e/global-setup.ts).
const landingPageId = E2E_LANDING_FIXTURES.blackAndWhite.publicId

test('termos pública da landing', async ({ page }) => {
  await page.goto('/conversao/' + landingPageId + '/termos')
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth + 1))
  await runResponsiveChecks(page)
})
