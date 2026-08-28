import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

/**
 * Playwright E2E harness (Chromium only).
 *
 * Install the browser once:
 *   bunx --bun playwright install --with-deps chromium
 *
 * CI / cold start: `bun run test:e2e` launches `bun run start` (needs a prior build).
 * Local with Next already running: `bun run test:e2e:local` (E2E_REUSE_SERVER=1).
 * Tests tagged @slow are skipped unless E2E_INCLUDE_SLOW=true.
 */

if (existsSync(".env.test")) {
  loadEnv({ path: ".env.test", override: false });
}

const baseURL = process.env.E2E_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";
const reuseAppServer = Boolean(process.env.E2E_REUSE_SERVER);
const includeSlow = process.env.E2E_INCLUDE_SLOW === "true";

export default defineConfig({
  testDir: "e2e/specs",
  testIgnore: ["**/_template.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  ...(includeSlow ? {} : { grepInvert: /@slow/ }),
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(reuseAppServer
    ? {}
    : {
        webServer: {
          command: "bun run start",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 90_000,
          env: {
            ...process.env,
            APP_ENV: process.env.APP_ENV || "test",
            E2E_TEST_MODE: process.env.E2E_TEST_MODE || "true",
            PUBLIC_FORM_LEAD_GATE_MODE: process.env.PUBLIC_FORM_LEAD_GATE_MODE || "radar",
          },
        },
      }),
});
