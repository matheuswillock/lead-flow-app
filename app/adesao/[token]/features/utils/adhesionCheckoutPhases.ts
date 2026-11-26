import type { AdhesionPaymentFieldErrors, AdhesionPaymentFieldName } from "./adhesionPaymentForm"
import { ADHESION_PAYMENT_FIELD_ORDER } from "./adhesionPaymentForm"

/** Fases da contratação self-checkout. Forma de pagamento e resumo ficam sempre na lateral. */
export type AdhesionPhaseId = "payer" | "address" | "card"

export const ADHESION_PHASE_LABEL: Record<AdhesionPhaseId, string> = {
  payer: "Seus dados",
  address: "Endereço",
  card: "Dados do cartão",
}

/** Campos que cada fase valida ao continuar. A fase do cartão valida no Abacate, não aqui. */
const PHASE_FIELDS: Record<AdhesionPhaseId, readonly AdhesionPaymentFieldName[]> = {
  payer: ["fullName", "email", "phone"],
  address: ["postalCode", "address", "addressNumber", "neighborhood", "city", "state"],
  card: [],
}

/**
 * Fases da forma escolhida: o cartão acrescenta os dados do cartão; o PIX legado do Asaas, o
 * endereço; o PIX do Abacate fica só com os dados do representante.
 */
export function adhesionPhasesFor(input: {
  isCard: boolean
  hasCardForm: boolean
  needsAddress: boolean
}): AdhesionPhaseId[] {
  if (input.isCard && input.hasCardForm) return ["payer", "card"]
  if (input.needsAddress) return ["payer", "address"]
  return ["payer"]
}

/** Primeiro campo com erro da fase, na ordem visual; `null` quando a fase está válida. */
export function firstInvalidFieldInPhase(
  errors: AdhesionPaymentFieldErrors,
  phase: AdhesionPhaseId,
): AdhesionPaymentFieldName | null {
  return (
    ADHESION_PAYMENT_FIELD_ORDER.find(
      (field) => PHASE_FIELDS[phase].includes(field) && errors[field],
    ) ?? null
  )
}

/** Campos validados pela fase; quem chama marca só esses como visitados ao continuar. */
export function fieldsOfPhase(phase: AdhesionPhaseId): readonly AdhesionPaymentFieldName[] {
  return PHASE_FIELDS[phase]
}

/** Índice da fase que valida o campo, ou -1 quando a forma atual não tem essa fase. */
export function phaseIndexOfField(
  phases: readonly AdhesionPhaseId[],
  field: AdhesionPaymentFieldName,
): number {
  return phases.findIndex((phase) => PHASE_FIELDS[phase].includes(field))
}

/** Id do elemento que recebe o foco quando o campo tem erro (o input do campo ou o título do cartão). */
export function fieldElementId(field: AdhesionPaymentFieldName): string {
  return `adhesion-${field}`
}
