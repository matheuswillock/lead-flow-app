const ORIGIN_TOKEN_KEYS = [
  "source",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
] as const

export function sanitizePublicFormOrigin(origin: Record<string, unknown>) {
  const result: Record<string, string> = {}
  for (const key of ORIGIN_TOKEN_KEYS) {
    if (typeof origin[key] !== "string") continue
    const value = String(origin[key])
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .slice(0, 160)
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
