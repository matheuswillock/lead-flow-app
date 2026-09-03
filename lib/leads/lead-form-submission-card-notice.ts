/**
 * SPEC 41-E3 (adendo 24/08, caso V5461O) + registro 03/09 (segundo caso
 * confirmado): a superfície do card de Formulários no dialog do lead NUNCA
 * exibe `submission.errorMessage` cru — é diagnóstico interno do sync
 * ("E-mail não informado (lead criado com telefone)"), não um erro para o
 * operador. Regra: lead criado/anexado com sucesso (`leadId` presente) não
 * mostra aviso nenhum; descarte real (sem `leadId`) mostra só um estado
 * neutro — o motivo detalhado fica no painel do form (outra entrega).
 */

export type LeadFormSubmissionCardNotice =
  | { kind: "none" }
  | { kind: "neutral"; message: string }

export const LEAD_FORM_SUBMISSION_NEUTRAL_NOTICE_MESSAGE = "Processada sem criação automática"

export function resolveLeadFormSubmissionCardNotice(submission: {
  leadId?: string | null
  errorMessage?: string | null
}): LeadFormSubmissionCardNotice {
  if (!submission.errorMessage) return { kind: "none" }
  if (submission.leadId) return { kind: "none" }
  return { kind: "neutral", message: LEAD_FORM_SUBMISSION_NEUTRAL_NOTICE_MESSAGE }
}
