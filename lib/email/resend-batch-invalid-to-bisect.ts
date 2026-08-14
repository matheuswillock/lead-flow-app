/**
 * Detecta 422 do Resend por `Invalid to` — lote inteiro rejeitado por 1+ destinatário inválido.
 * Usado para bisectar o lote e reenviar as metades válidas.
 */

export function isResendInvalidToValidationError(
  statusCode?: number,
  message?: string
): boolean {
  if (statusCode !== 422) return false
  const lower = (message ?? "").toLowerCase()
  return (
    lower.includes("invalid `to`") ||
    lower.includes("invalid to field") ||
    lower.includes("invalid to")
  )
}

/** Divide o lote ao meio para bisect (esquerda com o resto arredondado para cima). */
export function splitBatchForInvalidToBisect<T>(items: readonly T[]): [T[], T[]] {
  if (items.length < 2) {
    return [[...items], []]
  }
  const mid = Math.ceil(items.length / 2)
  return [items.slice(0, mid) as T[], items.slice(mid) as T[]]
}

export function formatResendInvalidToIsolatedFailureMessage(email: string): string {
  return `E-mail rejeitado pelo Resend (Invalid to): ${email}`
}
