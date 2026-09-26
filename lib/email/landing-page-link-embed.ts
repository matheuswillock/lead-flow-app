export function buildLandingPageLinkEmailSnippet({
  landingName,
  landingUrl,
  ctaLabel = "Simular agora",
}: {
  landingName: string
  landingUrl: string
  ctaLabel?: string
}): string {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const safeName = escape(landingName)
  const safeUrl = escape(landingUrl)
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#18181b;">${safeName}</p><p style="margin:0;"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#ff6900;color:#fff;text-decoration:none;font-weight:600;">${escape(ctaLabel)}</a></p>`
}
