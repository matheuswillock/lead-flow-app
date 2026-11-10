export type CouponDiscountType = "percent" | "fixed"

export type CouponDiscountRule = {
  type: CouponDiscountType
  value: number
}

/** Menor valor que ainda pode ser cobrado depois do desconto (mínimo aceito pelos provedores). */
export const MIN_CHARGE_AFTER_DISCOUNT = 5

function roundCurrency(value: number): number {
  return Number(value.toFixed(2))
}

/** Código sempre comparado e gravado em maiúsculas, sem espaços nas pontas. */
export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase()
}

/**
 * Desconto em reais sobre `total`, limitado para que sobre ao menos `MIN_CHARGE_AFTER_DISCOUNT`.
 * Devolve 0 quando o total é pequeno demais para receber desconto.
 */
export function computeCouponDiscountAmount(rule: CouponDiscountRule, total: number): number {
  if (!(total > MIN_CHARGE_AFTER_DISCOUNT) || !(rule.value > 0)) return 0
  const raw = rule.type === "percent" ? (total * rule.value) / 100 : rule.value
  const capped = Math.min(raw, total - MIN_CHARGE_AFTER_DISCOUNT)
  return roundCurrency(Math.max(0, capped))
}

export function applyCouponDiscount(rule: CouponDiscountRule | null, total: number): number {
  if (!rule) return roundCurrency(total)
  return roundCurrency(total - computeCouponDiscountAmount(rule, total))
}

export function describeCouponDiscount(rule: CouponDiscountRule): string {
  if (rule.type === "percent") {
    const percent = Number.isInteger(rule.value) ? String(rule.value) : rule.value.toFixed(2).replace(".", ",")
    return `${percent}% de desconto`
  }
  const amount = rule.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  return `${amount} de desconto`
}
