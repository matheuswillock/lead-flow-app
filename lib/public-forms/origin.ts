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
  "recipientEmail",
  "recipientName",
] as const

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Sufixo que escopa o `eventKey` por atribuição de campanha.
 *
 * Sem ele, o `eventKey` do `form_viewed` é `{session}:form_viewed:form` — e
 * `session` vem de um cookie de 30 dias. Como `form_viewed` dispara em todo
 * carregamento da página, qualquer visita anterior (link direto, teste do time,
 * disparo antigo) já criou a linha com `origin` sem `campaignId`. O upsert de
 * métrica é first-write-wins (`update: {}`), então o clique vindo da campanha
 * vira no-op e a atribuição nunca entra — a campanha exibe `form_viewed: 0`
 * mesmo com `form_started` e `form_completed` em 1.
 *
 * `form_started`/`form_completed` escapavam por sorte: exigem interação, então
 * quase sempre nascem na visita da campanha. Um destinatário que já tivesse
 * iniciado o formulário antes veria o mesmo sumiço.
 *
 * Escopar por `emailLogId` dá à visita atribuída uma linha própria, com
 * `createdAt` dentro da janela do disparo e `origin` correto, sem deixar de
 * colapsar recarregamentos do mesmo clique (o `emailLogId` é estável por
 * destinatário/disparo).
 */
export function buildAttributionEventKeySuffix(
  emailLogId: string | null | undefined
): string {
  const id = emailLogId?.trim()
  if (!id || !UUID_RE.test(id)) return ""
  return `:el:${id}`
}

/**
 * Chave dos eventos que o navegador emite via `track()`. Fica aqui — e não em
 * `metric-keys.ts`, que importa `node:crypto` e não pode ir para o bundle do
 * cliente — para que o renderer e o backfill derivem a chave da mesma fonte e
 * não divirjam.
 */
export function buildPublicFormTrackEventKey(input: {
  visitorSessionId: string
  eventType: string
  scope?: string | null
  suffix?: string | null
  emailLogId?: string | null
}): string {
  const scope = input.scope?.trim() || "form"
  const suffix = input.suffix?.trim() ? `:${input.suffix.trim()}` : ""
  return `${input.visitorSessionId}:${input.eventType}:${scope}${suffix}${buildAttributionEventKeySuffix(input.emailLogId)}`
}

export function isEmailCampaignFormOrigin(origin: Record<string, unknown> | null | undefined): boolean {
  if (!origin || typeof origin !== "object") return false
  if (origin.source === "email_campaign" || origin.attribution === "email_campaign") return true
  return typeof origin.emailLogId === "string"
}

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
    // E1: destinatário resolvido via EmailLog — necessário para o Radar
    // resolver perfil por e-mail quando ainda não há Lead (form_viewed/started).
    if (key === "recipientEmail") {
      const email = value.trim().toLowerCase()
      if (!EMAIL_RE.test(email)) continue
      result.recipientEmail = email.slice(0, 160)
      continue
    }
    // E6b: nome do destinatário (o par do e-mail acima) — mesma blindagem
    // genérica (rejeita cara de e-mail/telefone), só sem lowercase (nome
    // próprio) e com trim, já que este campo é exibido, não comparado.
    if (key === "recipientName") {
      const name = value.trim()
      if (!name || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(name) || /\d{8,}/.test(name)) continue
      result.recipientName = name
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
