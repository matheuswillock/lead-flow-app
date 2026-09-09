import {
  isTypedIdentityDivergentFromLead,
  normalizeIdentityEmail,
  type TypedFormIdentity,
} from "@/lib/radar/typed-identity-divergence"

/**
 * Identidade do destinatário conhecida via `cs_el` → `EmailLog`. `EmailLog`
 * não tem `recipientPhone` — a única fonte de contradição possível é e-mail.
 */
export type CampaignRecipientIdentity = {
  recipientEmail: string
  recipientName: string | null
}

const LOOSE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Varre respostas cruas (qualquer `mappingTarget`, inclusive sem mapping) atrás
 * de um valor com cara de e-mail que a extração nativa não capturou — o caso
 * KKJ (E6b): pergunta sem mapping de e-mail, resposta com e-mail digitado como
 * texto solto. Primeira ocorrência vence; não junta múltiplas respostas.
 */
export function findLooseEmailInAnswers(answers: Array<{ value: unknown }>): string | null {
  for (const answer of answers) {
    if (typeof answer.value !== "string") continue
    const text = answer.value.trim().toLowerCase()
    if (LOOSE_EMAIL_RE.test(text)) return text
  }
  return null
}

/**
 * `true` quando a identidade digitada na submissão NÃO diverge do destinatário
 * conhecido pelo `cs_el` (Adenda E1b/E6b, 02/09 — mesma guarda do #1107).
 * Reusa `isTypedIdentityDivergentFromLead`: encaminhamento (identidade
 * divergente) nunca herda a identidade de quem encaminhou.
 *
 * Limitação estrutural herdada do detector: como ele só acusa divergência
 * quando telefone **e** e-mail digitados estão presentes, um sinal isolado
 * (só telefone, ou só e-mail solto) nunca é suficiente para bloquear a
 * herança — é o comportamento correto quando o formulário genuinamente não
 * coletou o segundo campo (não há como provar divergência sem os dois lados).
 */
export function isSubmissionConvergentWithCampaignRecipient(
  typed: TypedFormIdentity,
  recipient: CampaignRecipientIdentity,
): boolean {
  const candidate = {
    name: recipient.recipientName,
    phone: null,
    email: recipient.recipientEmail,
  }
  return !isTypedIdentityDivergentFromLead(typed, candidate)
}

/**
 * Guarda mais estreita que `isSubmissionConvergentWithCampaignRecipient`, para
 * o caso em que o único sinal digitado disponível é um e-mail solto (sem
 * telefone digitado nesta mesma resposta para corroborar) — o perfil Radar
 * nasce/atualiza por evento único, e o detector composto do #1107 exige
 * telefone **e** e-mail para acusar divergência, o que o deixaria sempre
 * "convergente" aqui por falta do segundo sinal. Compara e-mail contra
 * e-mail: sinal isolado, mas direto o bastante para não precisar do par.
 */
export function isLooseEmailDivergentFromRecipient(
  looseEmail: string | null,
  recipient: CampaignRecipientIdentity,
): boolean {
  const typedEmail = normalizeIdentityEmail(looseEmail)
  if (!typedEmail) return false
  const recipientEmail = normalizeIdentityEmail(recipient.recipientEmail)
  if (!recipientEmail) return false
  return typedEmail !== recipientEmail
}
