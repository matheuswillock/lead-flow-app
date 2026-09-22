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
  // A CI roda na VPS self-hosted (2 vCPU): 4 workers ali disputam CPU com o
  // `next start` e estouram os timeouts do dialog do CRM (crm.spec.ts) —
  // medido em 10/09/2026, o spec falhou em 2 de 3 execuções com 4 workers.
  // E2E_WORKERS permite ajustar sem editar este arquivo.
  workers: process.env.E2E_WORKERS
    ? Number(process.env.E2E_WORKERS)
    : process.env.CI
      ? 2
      : 1,
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
            // Espelho client-side de E2E_TEST_MODE — ver lib/e2e/is-e2e-test-mode-client.ts.
            NEXT_PUBLIC_E2E_TEST_MODE: process.env.NEXT_PUBLIC_E2E_TEST_MODE || "true",
            PUBLIC_FORM_LEAD_GATE_MODE: process.env.PUBLIC_FORM_LEAD_GATE_MODE || "radar",
          },
        },
      }),
});
