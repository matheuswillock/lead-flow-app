import type { Page } from "@playwright/test"

/**
 * Fragmentos de ruído ambiental do E2E — pré-existentes em todas as páginas
 * autenticadas, fora do escopo da feature sob teste (verificado via traces
 * do Playwright: nenhum pertence às rotas da feature).
 *
 * - `/_vercel/insights/script.js`: `@vercel/analytics` injeta o script, mas o
 *   servidor do CI não o serve (404 + erro de MIME).
 * - `/monitoring`: túnel do Sentry não configurado no E2E (401).
 * - `/realtime/auth-token`: guard de realtime do shell autenticado (401).
 */
const ENVIRONMENTAL_NOISE_FRAGMENTS = [
  "/_vercel/insights/script.js",
  "/monitoring",
  "/realtime/auth-token",
]

export function isEnvironmentalNoise(text: string): boolean {
  return ENVIRONMENTAL_NOISE_FRAGMENTS.some((fragment) => text.includes(fragment))
}

export function trackPageNoise(page: Page): {
  consoleErrors: string[]
  failedRequests: string[]
} {
  const consoleErrors: string[] = []
  const failedRequests: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error" && !isEnvironmentalNoise(message.text())) {
      consoleErrors.push(message.text())
    }
  })
  page.on("response", (response) => {
    if (response.status() < 400) return
    const url = new URL(response.url())
    const entry = `${response.status()} ${response.request().method()} ${url.pathname}`
    if (!isEnvironmentalNoise(url.pathname) && !isEnvironmentalNoise(response.url())) {
      failedRequests.push(entry)
    }
  })
  return { consoleErrors, failedRequests }
}
