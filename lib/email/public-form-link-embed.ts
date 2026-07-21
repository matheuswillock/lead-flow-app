export function buildPublicFormLinkEmailSnippet({
  formName,
  formUrl,
  ctaLabel = "Responder formulário",
}: {
  formName: string
  formUrl: string
  ctaLabel?: string
}): string {
  const safeName = escapeHtml(formName)
  const safeUrl = escapeHtml(formUrl)
  const safeCta = escapeHtml(ctaLabel)

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
  <tr>
    <td style="padding:0;font-family:Arial,Helvetica,sans-serif;">
      <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#18181b;">
        ${safeName}
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="border-radius:8px;background-color:#ff6900;">
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              ${safeCta}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:12px 0 0;font-size:12px;line-height:1.4;color:#71717a;">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#71717a;text-decoration:underline;">
          ${safeUrl}
        </a>
      </p>
    </td>
  </tr>
</table>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
