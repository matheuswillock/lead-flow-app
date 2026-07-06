import { getFullUrl } from "@/lib/utils/app-url"
import { generateEmailUnsubscribeToken } from "@/lib/email/unsubscribe-token"

export function buildCampaignUnsubscribeUrl(contactId: string, teamId: string): string {
  const token = generateEmailUnsubscribeToken(contactId, teamId)
  return getFullUrl(`/email-unsubscribe/${token}`)
}

export function appendCampaignUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  const footer = `
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
<p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">
  Não deseja mais receber e-mails deste time?
  <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Descadastrar</a>
</p>`

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`)
  }

  return `${html}${footer}`
}

export function buildListUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}
