import { addDaysInTz, DEFAULT_TZ, formatIntimezone } from "@/lib/dates"

/** Intervalo entre vencimentos de parcelas do ledger de adesão (dias corridos). */
export const ADHESION_INSTALLMENT_DUE_INTERVAL_DAYS = 30

export function resolveAdhesionInstallmentDueDate(
  adhesionCreatedAt: Date,
  installmentIndex: number,
  tz = DEFAULT_TZ
): string {
  const safeIndex = Math.max(0, Math.trunc(installmentIndex))
  const dueAt = addDaysInTz(
    adhesionCreatedAt,
    safeIndex * ADHESION_INSTALLMENT_DUE_INTERVAL_DAYS,
    tz
  )
  return formatIntimezone(dueAt, "yyyy-MM-dd", tz)
}
