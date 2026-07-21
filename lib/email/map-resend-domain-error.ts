export type ResendDomainErrorContext = "connect" | "disconnect" | "verify" | "records"

const CONTEXT_FALLBACKS: Record<ResendDomainErrorContext, string> = {
  connect:
    "Não foi possível conectar o domínio. Verifique o endereço e tente novamente.",
  disconnect:
    "Não foi possível remover o domínio. Tente novamente em alguns instantes.",
  verify:
    "Não foi possível iniciar a verificação do domínio. Tente novamente em alguns instantes.",
  records:
    "Não foi possível carregar os registros DNS. Tente novamente em alguns instantes.",
}

function isRegisteredToAnotherTeam(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("registered to another team") || lower.includes("domain claim")
}

function isAlreadyRegistered(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("already exists") || lower.includes("already registered")
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

  if (isAlreadyRegistered(message)) {
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
