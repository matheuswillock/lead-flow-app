import { test, expect } from '@playwright/test'
import { E2E_LANDING_FIXTURES } from '../../../../support/landing-pages'
import { runResponsiveChecks } from '../../../../support/responsive'

// A landing publicada vem do globalSetup (e2e/global-setup.ts).
const landingPageId = E2E_LANDING_FIXTURES.blackAndWhite.publicId

test('documento legal público', async ({ page }) => {
  await page.goto('/conversao/' + landingPageId + '/privacidade')
  await expect(page.locator('main')).toBeVisible()
  await runResponsiveChecks(page)
})
