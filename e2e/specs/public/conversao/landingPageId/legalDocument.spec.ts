import { test, expect } from '@playwright/test'
import { runResponsiveChecks } from '../../../../support/responsive'
test('documento legal público', async ({ page }) => { const id = process.env.E2E_PUBLIC_LANDING_PAGE_ID; test.skip(!id); await page.goto('/conversao/' + id + '/privacidade'); await expect(page.locator('main')).toBeVisible(); await runResponsiveChecks(page) })
