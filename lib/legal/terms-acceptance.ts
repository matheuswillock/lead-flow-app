import { LEGAL_DOCUMENTS_VERSION } from "./legal-document-types"

/** Resposta de erro quando a jornada de contratação chega sem o aceite dos documentos legais. */
export const TERMS_ACCEPTANCE_REQUIRED_MESSAGE = "Aceite os termos de uso para continuar."

/** Só o booleano `true` conta como aceite; texto, número ou ausência são recusados. */
export function hasTermsAcceptance(value: unknown): value is true {
  return value === true
}

/** Linha de aceite gravada nas notas do lead, no mesmo texto do auto-checkout. */
export function buildTermsAcceptanceNote(
  acceptedAt: string,
  version: string = LEGAL_DOCUMENTS_VERSION,
): string {
  return `Aceite dos Termos de Uso, da Política de Privacidade e da Política de Cookies da contratação (versão ${version}) em ${acceptedAt}`
}
