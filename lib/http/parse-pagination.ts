/**
 * Parsing de `?page=`/`?pageSize=` que nunca deixa passar valor não-inteiro.
 *
 * `Number("abc")` é `NaN`, e `Math.max(1, NaN)` continua `NaN` — o clamp comum
 * com `Math.min`/`Math.max` NÃO filtra lixo. Enquanto a paginação acontecia em
 * memória (`ids.slice`), `NaN` era coagido silenciosamente; com `LIMIT`/`OFFSET`
 * no banco, o mesmo valor vira erro do Postgres e um 500 a partir de uma query
 * string malformada. Fracionário (`pageSize=1.5`) tem o mesmo destino.
 */

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (value === null || value.trim() === "") return fallback
  // `Number` (e não `parseInt`) para recusar "12abc" em vez de aceitar 12.
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function parsePageParam(value: string | null, fallback = 1): number {
  return parsePositiveInteger(value, fallback)
}

export function parsePageSizeParam(
  value: string | null,
  options: { fallback?: number; max?: number } = {}
): number {
  const { fallback = 20, max = 100 } = options
  return Math.min(max, parsePositiveInteger(value, fallback))
}
