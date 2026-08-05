const ORIGIN_TOKEN_KEYS = [
  "source",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "emailLogId",
  "cs_el",
  "campaignId",
  "dispatchId",
] as const

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function sanitizePublicFormOrigin(origin: Record<string, unknown>) {
  const result: Record<string, string> = {}
  for (const key of ORIGIN_TOKEN_KEYS) {
    if (typeof origin[key] !== "string") continue
    const value = String(origin[key])
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .slice(0, 160)
    if (key === "emailLogId" || key === "cs_el" || key === "campaignId" || key === "dispatchId") {
      if (!UUID_RE.test(value.trim())) continue
      result[key === "cs_el" ? "emailLogId" : key] = value.trim()
      continue
    }
    if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(value) || /\d{8,}/.test(value)) continue
    result[key] = value
  }
  for (const key of ["landingUrl", "referrer"] as const) {
    if (typeof origin[key] !== "string") continue
    try {
      const parsed = new URL(String(origin[key]))
      result[key] = `${parsed.origin}${parsed.pathname}`.slice(0, 500)
    } catch {
      // Uma origem inválida não deve bloquear o formulário ou o pixel.
    }
  }
  return result
}
