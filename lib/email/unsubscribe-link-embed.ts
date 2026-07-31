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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
