import { normalizeLeadPhoneDigits } from "@/lib/masks"

/**
 * Identidade **digitada** na submissão (respostas `native_field` name/phone/email)
 * versus identidade do lead candidato do gate.
 *
 * Existe por causa do bug de 31/08: o gate ancora no perfil Radar do
 * destinatário do e-mail, e o `leadIdMatch` (vínculo permanente criado na
 * primeira promoção) vencia tudo. Quem recebia o e-mail encaminhado e
 * respondia com a própria identidade era anexado, para sempre, no card do
 * destinatário original — o prospect real nunca virava card.
 */
export type TypedFormIdentity = {
  name: string | null
  phone: string | null
  email: string | null
}

export type CandidateLeadIdentity = {
  name: string | null
  phone: string | null
  email: string | null
}

export function normalizeIdentityEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? ""
  if (!trimmed || !trimmed.includes("@") || trimmed.includes(" ")) return null
  return trimmed
}

/** Só dígitos, sem DDI, com o mínimo de um DDD + assinante fixo (10 dígitos). */
export function normalizeIdentityPhone(value: string | null | undefined): string | null {
  const digits = normalizeLeadPhoneDigits(value ?? "")
  const suffix = digits.slice(-11)
  return suffix.length >= 10 ? suffix : null
}

/**
 * Compara pelo sufixo comum: o mesmo número aparece como `5511…` no perfil e
 * `11…` no cadastro do lead, e um fixo tem 10 dígitos contra 11 do celular.
 */
function samePhone(left: string, right: string): boolean {
  const length = Math.min(left.length, right.length)
  return left.slice(-length) === right.slice(-length)
}

/**
 * `true` só quando a submissão trouxe telefone **e** e-mail digitados e
 * **nenhum dos dois** bate com o lead candidato. Identidade incompleta,
 * telefone inválido ou lead sem contato algum devolvem `false` — o anexo atual
 * continua valendo. Nome não entra: sozinho é sinal fraco demais para partir um
 * card em dois.
 */
export function isTypedIdentityDivergentFromLead(
  typed: TypedFormIdentity,
  lead: CandidateLeadIdentity | null,
): boolean {
  const typedPhone = normalizeIdentityPhone(typed.phone)
  const typedEmail = normalizeIdentityEmail(typed.email)
  if (!typedPhone || !typedEmail) return false
  if (!lead) return false

  const leadPhone = normalizeIdentityPhone(lead.phone)
  const leadEmail = normalizeIdentityEmail(lead.email)
  // Lead sem telefone e sem e-mail não contradiz nada: anexar e completar o
  // cadastro é exatamente o que o gate promete.
  if (!leadPhone && !leadEmail) return false

  if (leadPhone && samePhone(leadPhone, typedPhone)) return false
  if (leadEmail && leadEmail === typedEmail) return false
  return true
}
