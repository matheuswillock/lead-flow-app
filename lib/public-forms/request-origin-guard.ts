import { getAppUrl } from "@/lib/utils/app-url"
import { normalizeHostname } from "@/lib/proxy/forms-host"

/**
 * Guard de origem pras rotas públicas de formulário (`/progress`, `/events`).
 * Formulário público é servido pelo domínio da aplicação OU pelo domínio de
 * formulários do time (serving multi-tenant) — não existe embed via iframe em
 * site de terceiro (diferente do pixel de Radar, que tem allowlist
 * configurável por time). Mesmo padrão de
 * `RadarPixelHitUseCase.isOriginAllowed`, adaptado.
 *
 * Header `Origin` ausente é permitido — alguns browsers/cenários same-origin
 * legítimos omitem o header; o objetivo é bloquear POST forjado de um script
 * externo, que sempre carrega `Origin` setado pelo próprio browser (não
 * falsificável por JS).
 *
 * Request SAME-ORIGIN (host da própria origem == host que recebeu o request)
 * é sempre permitido: cobre os domínios de formulários dos times sem consulta
 * a banco. Um atacante em `evil.com` envia `Origin: evil.com`, que nunca
 * coincide com o host servido — não há enfraquecimento do guard.
 */
export function isPublicFormRequestOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return true

  let originHostname: string | null = null
  try {
    originHostname = normalizeHostname(new URL(origin).hostname)
  } catch {
    originHostname = null
  }

  const requestHostname =
    normalizeHostname(request.headers.get("x-forwarded-host")) ??
    normalizeHostname(request.headers.get("host"))

  if (originHostname && requestHostname && originHostname === requestHostname) {
    return true
  }

  try {
    const appOrigin = new URL(getAppUrl()).origin
    return new URL(origin).origin === appOrigin
  } catch (error) {
    console.error(
      "[isPublicFormRequestOriginAllowed] NEXT_PUBLIC_APP_URL ausente ou inválida — permitindo por padrão",
      error,
    )
    return true
  }
}
