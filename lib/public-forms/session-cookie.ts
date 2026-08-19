const COOKIE_NAME = "cs_form_vs"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 dias

/**
 * Lê o visitorSessionId do cookie persistente `cs_form_vs`.
 * Formato: `<publicId>:<sessionId>` — evita colisão entre formulários
 * diferentes no mesmo domínio sem usar um cookie por publicId.
 */
export function readFormSessionCookie(publicId: string): string | null {
  if (typeof document === "undefined") return null
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1]
  if (!raw) return null
  try {
    const decoded = decodeURIComponent(raw)
    const [cookiePublicId, sessionId] = decoded.split(":", 2)
    if (cookiePublicId !== publicId || !sessionId) return null
    return sessionId
  } catch {
    return null
  }
}

/**
 * Persiste o visitorSessionId no cookie `cs_form_vs`.
 * SameSite=Lax: enviado em navegação de topo (link de campanha)
 * mas não em requests cross-site de subrecursos — seguro contra CSRF.
 * Sem flag Secure em dev (localhost não tem HTTPS), mas sempre Secure em prod.
 */
export function writeFormSessionCookie(publicId: string, sessionId: string): void {
  if (typeof document === "undefined") return
  const value = encodeURIComponent(`${publicId}:${sessionId}`)
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`
}
