import { getAppUrl } from "@/lib/utils/app-url"

/**
 * Guard de origem pras rotas públicas de formulário (`/progress`, `/events`).
 * Formulário público só é servido pelo próprio domínio da aplicação — não
 * existe embed via iframe em site de terceiro (diferente do pixel de Radar,
 * que tem allowlist configurável por time). Mesmo padrão de
 * `RadarPixelHitUseCase.isOriginAllowed`, adaptado: aqui só há uma origem
 * válida (a própria app), não uma lista configurável.
 *
 * Header `Origin` ausente é permitido — alguns browsers/cenários same-origin
 * legítimos omitem o header; o objetivo é bloquear POST forjado de um script
 * externo, que sempre carrega `Origin` setado pelo próprio browser (não
 * falsificável por JS).
 */
export function isPublicFormRequestOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return true

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
