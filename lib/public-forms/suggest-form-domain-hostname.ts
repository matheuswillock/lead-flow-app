/**
 * Sugere o subdomínio de formulários a partir do domínio de ENVIO do time:
 * `mail.imobiliariax.com.br` → `forms.imobiliariax.com.br`.
 *
 * Heurística sem Public Suffix List: com 4+ labels o primeiro é tratado como
 * subdomínio técnico e cai fora; com 3 labels só cai se for um prefixo de
 * e-mail conhecido (senão pode ser o apex de um .com.br).
 */

const KNOWN_EMAIL_SUBDOMAIN_LABELS = new Set([
  "mail",
  "email",
  "envio",
  "send",
  "news",
  "mkt",
  "smtp",
  "notificacoes",
])

export function suggestFormDomainHostname(sendingDomainName: string): string | null {
  const normalized = sendingDomainName.trim().toLowerCase().replace(/\.$/, "")
  if (!normalized || !normalized.includes(".")) return null

  const labels = normalized.split(".")
  if (labels.some((label) => label.length === 0)) return null

  if (labels.length >= 4) {
    return `forms.${labels.slice(1).join(".")}`
  }

  if (labels.length === 3 && KNOWN_EMAIL_SUBDOMAIN_LABELS.has(labels[0])) {
    return `forms.${labels.slice(1).join(".")}`
  }

  return `forms.${normalized}`
}
