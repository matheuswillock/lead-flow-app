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
  // Status vistos em URLs ambientais: o texto do console ("Failed to load
  // resource ... status of 401") não traz a URL, então a correlação é pelo
  // status — o evento `response` sempre precede o erro de console do recurso.
  // Qualquer 401/404 de rota da feature continua falhando via failedRequests.
  const environmentalStatuses = new Set<number>()
  page.on("console", (message) => {
    if (message.type() !== "error") return
    const text = message.text()
    const locationUrl = message.location()?.url ?? ""
    if (isEnvironmentalNoise(text) || isEnvironmentalNoise(locationUrl)) return
    const resourceStatus = /^Failed to load resource: the server responded with a status of (\d+)/.exec(text)
    if (resourceStatus && environmentalStatuses.has(Number(resourceStatus[1]))) return
    consoleErrors.push(text)
  })
  page.on("response", (response) => {
    if (response.status() < 400) return
    const url = new URL(response.url())
    const entry = `${response.status()} ${response.request().method()} ${url.pathname}`
    if (isEnvironmentalNoise(url.pathname) || isEnvironmentalNoise(response.url())) {
      environmentalStatuses.add(response.status())
      return
    }
    failedRequests.push(entry)
  })
  return { consoleErrors, failedRequests }
}
