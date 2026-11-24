import type { SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"

/** Quanto o PIX economiza em relação ao cartão no plano inteiro; zero quando não há diferença. */
export function pixSavingsAmount(option: SelfCheckoutCycleOption): number {
  if (!option.creditCardTotal) return 0
  const saving = Math.round((option.creditCardTotal - option.pixTotal) * 100) / 100
  return saving > 0 ? saving : 0
}

/** Valor de cada parcela do cartão, arredondado para centavos. */
export function cardInstallmentAmount(option: SelfCheckoutCycleOption): number | null {
  if (!option.creditCardTotal) return null
  const installments = Math.max(1, option.maxInstallments ?? option.months)
  return Math.round((option.creditCardTotal / installments) * 100) / 100
}
