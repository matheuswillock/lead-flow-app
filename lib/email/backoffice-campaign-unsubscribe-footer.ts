import { getFullUrl } from "@/lib/utils/app-url"
import { generateBackofficeEmailUnsubscribeToken } from "@/lib/email/backoffice-unsubscribe-token"

export function buildBackofficeCampaignUnsubscribeUrl(contactId: string, campaignId: string): string {
  const token = generateBackofficeEmailUnsubscribeToken(contactId, campaignId)
  return getFullUrl(`/backoffice-email-unsubscribe/${token}`)
}

export function appendBackofficeCampaignUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  const footer = `
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
<p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">
  Não deseja mais receber estes e-mails?
  <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Descadastrar</a>
</p>`

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`)
  }

  return `${html}${footer}`
}

/**
 * O link visível no corpo do e-mail aponta para a página de confirmação
 * (`buildBackofficeCampaignUnsubscribeUrl`), mas o cabeçalho `List-Unsubscribe`
 * usado pelo one-click unsubscribe (RFC 8058) precisa apontar direto para o
 * endpoint POST — clientes de e-mail fazem o POST nessa mesma URL, e a página
 * de confirmação não tem handler de POST.
 */
export function buildBackofficeListUnsubscribeHeaders(
  contactId: string,
  campaignId: string
): Record<string, string> {
  const token = generateBackofficeEmailUnsubscribeToken(contactId, campaignId)
  const postUrl = getFullUrl(
    `/api/v1/backoffice/public/email-campaigns/unsubscribe?token=${encodeURIComponent(token)}`
  )

  return {
    "List-Unsubscribe": `<${postUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}
