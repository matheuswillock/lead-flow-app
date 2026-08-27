export type ResendDomainErrorContext =
  | "connect"
  | "disconnect"
  | "verify"
  | "records"
  | "tracking"

const CONTEXT_FALLBACKS: Record<ResendDomainErrorContext, string> = {
  connect:
    "Não foi possível conectar o domínio. Verifique o endereço e tente novamente.",
  disconnect:
    "Não foi possível remover o domínio. Tente novamente em alguns instantes.",
  verify:
    "Não foi possível iniciar a verificação do domínio. Tente novamente em alguns instantes.",
  records:
    "Não foi possível carregar os registros DNS. Tente novamente em alguns instantes.",
  tracking:
    "Não foi possível configurar as métricas de tracking. Tente novamente em alguns instantes.",
}

function isRegisteredToAnotherTeam(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("registered to another team") || lower.includes("domain claim")
}

function isAlreadyRegistered(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("already exists") || lower.includes("already registered")
}

export function isTrackingSubdomainAlreadyExists(message: string | undefined): boolean {
  if (!message?.trim()) return false
  const lower = message.toLowerCase()
  return (
    lower.includes("tracking domain") &&
    lower.includes("already exists")
  )
}

/**
 * Formato mínimo do erro do SDK do Resend. `statusCode` chega como `number |
 * null` no `ErrorResponse` deles; aceitar os dois evita cast no call site.
 */
export type ResendDomainErrorLike = {
  statusCode?: number | null
  message?: string
} | null

/**
 * Conflito plausível no endpoint de tracking: ou o provedor respondeu 409, ou a
 * mensagem é a de subdomínio já existente. É só a suspeita — quem chama ainda
 * precisa confirmar se o subdomínio em conflito é o nosso.
 */
export function isTrackingSubdomainConflict(error: ResendDomainErrorLike): boolean {
  if (!error) return false
  return error.statusCode === 409 || isTrackingSubdomainAlreadyExists(error.message)
}

const TRACKING_SUBDOMAIN_IN_MESSAGE_RE = /subdomain\s+"([^"]+)"/i

/** O subdomínio citado entre aspas na mensagem de conflito, quando informado. */
export function extractConflictingTrackingSubdomain(message: string | undefined): string | null {
  const captured = message?.match(TRACKING_SUBDOMAIN_IN_MESSAGE_RE)?.[1]?.trim().toLowerCase()
  return captured || null
}

/**
 * O conflito foi causado pela própria chamada anterior deste fluxo.
 *
 * Vale quando o subdomínio citado é exatamente o que acabamos de configurar.
 * Sem subdomínio citado também vale: o domínio nasceu segundos antes, nesta
 * mesma execução, e ninguém mais teve janela para configurar tracking nele.
 * Subdomínio divergente NÃO é nosso — isso sobe como erro.
 */
export function isSelfInflictedTrackingConflict(
  error: ResendDomainErrorLike,
  expectedTrackingSubdomain: string
): boolean {
  if (!isTrackingSubdomainConflict(error)) return false
  if (!isTrackingSubdomainAlreadyExists(error?.message)) return false

  const conflicting = extractConflictingTrackingSubdomain(error?.message)
  return conflicting === null || conflicting === expectedTrackingSubdomain.trim().toLowerCase()
}

function isInvalidDomain(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("invalid domain") || lower.includes("not a valid")
}

function isRateLimited(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("rate limit") || lower.includes("too many requests")
}

export function mapResendDomainError(
  message: string | undefined,
  context: ResendDomainErrorContext,
  domainName?: string
): string {
  if (!message?.trim()) {
    return CONTEXT_FALLBACKS[context]
  }

  const domainLabel = domainName?.trim() || "informado"

  if (isRegisteredToAnotherTeam(message)) {
    return `O domínio ${domainLabel} já está vinculado a outra conta. Entre em contato com o suporte do Corretor Studio informando o domínio para solicitar a transferência.`
  }

  // Só chega aqui o conflito que NÃO é nosso — o do próprio fluxo é tratado
  // como sucesso idempotente antes de virar mensagem. Não adianta pedir "escolha
  // outro subdomínio": o operador não tem esse controle na tela, o subdomínio é
  // fixo do produto. O caminho de saída é o suporte.
  if (context === "tracking" && isTrackingSubdomainAlreadyExists(message)) {
    return `O subdomínio de tracking do domínio ${domainLabel} já está vinculado a outra configuração. Entre em contato com o suporte do Corretor Studio informando o domínio.`
  }

  if (isAlreadyRegistered(message) && context !== "tracking") {
    return "Este domínio já está cadastrado. Verifique se não foi conectado antes ou use outro domínio."
  }

  if (isInvalidDomain(message)) {
    return "Informe um domínio válido (ex.: seudominio.com.br), sem http:// ou caminhos."
  }

  if (isRateLimited(message)) {
    return "Muitas tentativas em sequência. Aguarde alguns minutos e tente novamente."
  }

  return CONTEXT_FALLBACKS[context]
}
