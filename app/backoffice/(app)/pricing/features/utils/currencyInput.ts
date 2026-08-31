/**
 * Utilitário puro de parse/format de valores monetários do dialog de precificação.
 *
 * Aceita dois formatos de entrada:
 * - Digitação brasileira: `"12.345,67"`, `"R$ 10.000,00"`, `"12,35"` — ponto é
 *   milhar, vírgula é decimal.
 * - Estado canônico do form (hidratação de edição grava `String(price)` em
 *   `BackofficePricingContext.productToFormData`): `"12345.67"`, `"10000"` —
 *   ponto único seguido de 1-2 dígitos é decimal US.
 *
 * Regra de desambiguação do ponto sem vírgula: um único ponto seguido de
 * exatamente 1-2 dígitos no fim é decimal canônico; pontos com grupos de 3
 * dígitos são milhar; qualquer outro arranjo é inválido.
 */

const BRAZILIAN_CURRENCY_CHARS = /^[\d.,]+$/
const CANONICAL_US_DECIMAL = /^\d+\.\d{1,2}$/
const THOUSAND_GROUPS = /^\d{1,3}(\.\d{3})+$/

export function parseBrazilianCurrency(input: string): number | null {
  const compact = input.replace(/R\$/gi, "").replace(/\s+/g, "")
  if (!compact || !BRAZILIAN_CURRENCY_CHARS.test(compact)) return null

  const commaCount = (compact.match(/,/g) ?? []).length
  if (commaCount > 1) return null

  let normalized: string
  if (commaCount === 1) {
    // Com vírgula: fração de 1-2 dígitos e, se houver pontos, agrupamento de
    // milhar válido — "1,234" e "12.34,56" são inválidos (fração de 3 dígitos
    // divergia entre tela e banco; review do PR #1102).
    const [integerPart, fractionPart] = compact.split(",")
    if (!/^\d{1,2}$/.test(fractionPart)) return null
    if (integerPart.includes(".") && !THOUSAND_GROUPS.test(integerPart)) return null
    if (!integerPart || !/^[\d.]+$/.test(integerPart)) return null
    normalized = integerPart.replace(/\./g, "") + "." + fractionPart
  } else if (!compact.includes(".")) {
    normalized = compact
  } else if (CANONICAL_US_DECIMAL.test(compact)) {
    normalized = compact
  } else if (THOUSAND_GROUPS.test(compact)) {
    normalized = compact.replace(/\./g, "")
  } else {
    return null
  }

  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/**
 * Converte o texto digitado para o valor canônico do form state (`"12345.67"`).
 * Vazio vira `""`; entrada inválida é devolvida crua para a validação existente
 * continuar bloqueando o submit.
 */
export function normalizeCurrencyState(input: string): string {
  if (!input.trim()) return ""
  const parsed = parseBrazilianCurrency(input)
  return parsed == null ? input : String(parsed)
}

export function formatBrazilianCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Formata o valor salvo no form state para exibição (blur/render sem foco).
 * Devolve o cru quando não parseia, para o usuário ver o que digitou.
 */
export function formatCurrencyStateForDisplay(state: string): string {
  if (!state.trim()) return ""
  const parsed = parseBrazilianCurrency(state)
  return parsed == null ? state : formatBrazilianCurrency(parsed)
}
