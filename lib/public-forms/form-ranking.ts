import { safeRate } from "@/lib/email/analytics-rates"

/** Visualizações mínimas para entrar no ranking (evita taxa 100% com amostra ínfima). */
export const FORM_RANKING_MIN_VIEWS = 10

export type FormConversionTotalsInput = {
  formId: string
  name: string
  viewed: number
  completed: number
}

export type RankedForm = FormConversionTotalsInput & {
  conversionRate: number
  rank: number
}

function hasEnoughData(row: FormConversionTotalsInput): boolean {
  return row.viewed >= FORM_RANKING_MIN_VIEWS
}

/**
 * Rankeia formulários por taxa de conversão (sessões form_completed / form_viewed).
 * Empate: maior número de conclusões, depois nome.
 * Sem visualizações suficientes: excluído.
 */
export function rankTopFormsByConversion(
  rows: FormConversionTotalsInput[],
  limit = 3,
): RankedForm[] {
  return [...rows]
    .filter(hasEnoughData)
    .sort((a, b) => {
      const rateA = safeRate(a.completed, a.viewed)
      const rateB = safeRate(b.completed, b.viewed)
      if (rateB !== rateA) return rateB - rateA
      if (b.completed !== a.completed) return b.completed - a.completed
      return a.name.localeCompare(b.name, "pt-BR")
    })
    .slice(0, limit)
    .map((row, index) => ({
      ...row,
      conversionRate: safeRate(row.completed, row.viewed),
      rank: index + 1,
    }))
}
