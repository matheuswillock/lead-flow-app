import { getAppUrl } from "@/lib/utils/app-url"

function hostOf(value: string | null): string | null {
  if (!value) return null
  return value.split(",")[0]?.trim().toLowerCase() || null
}

/**
 * Proteção de Origin (CSRF) para rotas de escrita autenticadas por cookie. Diferente do guard dos
 * formulários públicos, a ausência de `Origin` NÃO é aceita: todo `fetch` de escrita do browser o
 * envia, e uma requisição forjada de outro site carrega o `Origin` dele.
 */
export function isSameOriginWrite(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin"
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }
  const requestHost = hostOf(request.headers.get("x-forwarded-host")) ?? hostOf(request.headers.get("host"))
  if (requestHost && parsed.host.toLowerCase() === requestHost) return true
  try {
    return parsed.origin === new URL(getAppUrl()).origin
  } catch {
    return false
  }
}
