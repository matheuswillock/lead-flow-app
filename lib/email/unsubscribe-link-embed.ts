export const EMAIL_UNSUBSCRIBE_LINK_VARIABLE_KEY = "link_descadastro"

export const EMAIL_UNSUBSCRIBE_LINK_TOKEN = `{{${EMAIL_UNSUBSCRIBE_LINK_VARIABLE_KEY}}}`

export function templateIncludesManualUnsubscribeLink(template: string): boolean {
  return /\{\{\s*link_descadastro\s*\}\}/i.test(template)
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
 * ao link de descadastro (ex.: `{{unsubscribe_url}}` colado de um template genérico)
 * e sugere o token nativo da plataforma (`{{link_descadastro}}`) na mensagem de erro.
 */
export function suggestUnsubscribeTokenHint(unresolvedTokens: string[]): string | null {
  const lookalike = unresolvedTokens.find((token) =>
    UNSUBSCRIBE_LOOKALIKE_PATTERNS.some((pattern) => pattern.test(token))
  )
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
