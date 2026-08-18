export const EMAIL_UNSUBSCRIBE_LINK_VARIABLE_KEY = "link_descadastro"

export const EMAIL_UNSUBSCRIBE_LINK_ALIAS_KEYS = ["unsubscribe_url", "unsubscribe_link"] as const

export const EMAIL_UNSUBSCRIBE_LINK_KEYS = [
  EMAIL_UNSUBSCRIBE_LINK_VARIABLE_KEY,
  ...EMAIL_UNSUBSCRIBE_LINK_ALIAS_KEYS,
] as const

export const EMAIL_UNSUBSCRIBE_LINK_TOKEN = `{{${EMAIL_UNSUBSCRIBE_LINK_VARIABLE_KEY}}}`

const MANUAL_UNSUBSCRIBE_TOKEN_RE =
  /\{\{\s*(?:link_descadastro|unsubscribe_url|unsubscribe_link)\s*\}\}/i

const LOOKALIKE_TOKEN_RE = /\{\{\s*(?:unsubscribe_url|unsubscribe_link)\s*\}\}/gi

export function isEmailUnsubscribeLinkVariableKey(key: string): boolean {
  const normalized = key.trim().toLowerCase()
  return (EMAIL_UNSUBSCRIBE_LINK_KEYS as readonly string[]).includes(normalized)
}

export function templateIncludesManualUnsubscribeLink(template: string): boolean {
  return MANUAL_UNSUBSCRIBE_TOKEN_RE.test(template)
}

/**
 * Reescreve tokens genéricos de descadastro (`unsubscribe_url` / `unsubscribe_link`)
 * para o token nativo da plataforma.
 */
export function normalizeUnsubscribeLookalikeTokens(template: string): string {
  return template.replace(LOOKALIKE_TOKEN_RE, EMAIL_UNSUBSCRIBE_LINK_TOKEN)
}

export function buildUnsubscribeLinkEmailSnippet({
  linkToken = EMAIL_UNSUBSCRIBE_LINK_TOKEN,
  ctaLabel = "Cancelar inscrição",
}: {
  linkToken?: string
  ctaLabel?: string
} = {}): string {
  const safeToken = escapeHtml(linkToken)
  const safeCta = escapeHtml(ctaLabel)

  return `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">
  Não deseja mais receber e-mails deste time?
  <a href="${safeToken}" style="color:#6b7280;text-decoration:underline;">${safeCta}</a>
</p>`
}

const UNSUBSCRIBE_LOOKALIKE_PATTERNS = [
  /unsubscribe/i,
  /descadastr/i,
  /desinscrev/i,
  /opt.?out/i,
]

/**
 * Detecta, entre tokens não resolvidos de um template, algum que pareça se referir
 * ao link de descadastro (ex.: `{{opt_out_link}}`) e sugere o token nativo.
 * Aliases já preenchidos pelo interpolador (`unsubscribe_url`) não entram aqui.
 */
export function suggestUnsubscribeTokenHint(unresolvedTokens: string[]): string | null {
  const lookalike = unresolvedTokens.find((token) => {
    if (isEmailUnsubscribeLinkVariableKey(token)) return false
    return UNSUBSCRIBE_LOOKALIKE_PATTERNS.some((pattern) => pattern.test(token))
  })
  if (!lookalike) return null

  return `Se {{${lookalike}}} deveria ser o link de descadastro, use ${EMAIL_UNSUBSCRIBE_LINK_TOKEN} (variável nativa da plataforma).`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
