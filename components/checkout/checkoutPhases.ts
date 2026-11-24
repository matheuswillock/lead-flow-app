/** Fase de um checkout: título do stepper e os campos que ela valida ao continuar. */
export type CheckoutPhase = {
  label: string
  fields: readonly string[]
}

export function nextPhaseIndex(current: number, phaseCount: number): number {
  return Math.min(current + 1, phaseCount - 1)
}

export function previousPhaseIndex(current: number): number {
  return Math.max(current - 1, 0)
}

/** Leva à última fase válida quando a lista de fases muda (ex.: cartão → PIX). */
export function clampPhaseIndex(current: number, phaseCount: number): number {
  return Math.max(0, Math.min(current, phaseCount - 1))
}

/** Índice da fase que valida o campo, ou -1 quando o campo não pertence a nenhuma fase. */
export function phaseIndexForField(phases: readonly CheckoutPhase[], field: string): number {
  return phases.findIndex((phase) => phase.fields.includes(field))
}

/** Só os erros dos campos da fase: Continuar não bloqueia por campos de fases futuras. */
export function errorsForPhase<E extends string>(
  phase: CheckoutPhase,
  errors: Partial<Record<string, E>>,
): Partial<Record<string, E>> {
  const result: Partial<Record<string, E>> = {}
  for (const field of phase.fields) {
    const message = errors[field]
    if (message) result[field] = message
  }
  return result
}
