/**
 * Regras de cotação do simulador de planos. Puro: sem I/O, sem React.
 * Porta fiel da lógica do protótipo validado (compute/passes/priced).
 */

/** Faixas etárias do painel, na ordem da base. Ex.: "00-18" -> 0..18. */
export const AGE_BANDS = ["00-18", "19-23", "24-28", "29-33", "34-38", "39-43", "44-48", "49-53", "54-58", "59-199"] as const

export type AgeBand = (typeof AGE_BANDS)[number]

/** Quantidade de vidas por faixa, alinhada a AGE_BANDS. */
export type LivesByBand = number[]

export type CatalogTable = {
  chave: string
  estado: string
  operatorName: string
  planoId: number
  plano: string
  tabela: string
  acomodacao: string
  contratacao: string
  coparticipacao: string
  aceitaMei: boolean
  vidasMin: number
  vidasMax: number
  precos: Record<string, number>
}

export type SimulationFilters = {
  acomodacoes: string[]
  coparticipacoes: string[]
  contratacoes: string[]
  /** Ids de credenciados hospitalares: o plano precisa cobrir todos. */
  hospitalIds: number[]
  mei: boolean
  respeitarMinimoVidas: boolean
  valorMin: number | null
  valorMax: number | null
}

export const EMPTY_FILTERS: SimulationFilters = {
  acomodacoes: [],
  coparticipacoes: [],
  contratacoes: [],
  hospitalIds: [],
  mei: false,
  respeitarMinimoVidas: true,
  valorMin: null,
  valorMax: null,
}

export type SimulationRow<T extends CatalogTable = CatalogTable> = { table: T; total: number }

export type SimulationResult<T extends CatalogTable = CatalogTable> = {
  rows: SimulationRow<T>[]
  totalVidas: number
  ocultosPorVidas: number
  ocultosPorValor: number
}

/** Converte a lista de idades informadas em vidas por faixa. Idades fora de 0..199 são ignoradas. */
export function livesByBandFromAges(ages: number[]): LivesByBand {
  const counts: LivesByBand = AGE_BANDS.map(() => 0)
  for (const age of ages) {
    if (!Number.isInteger(age) || age < 0 || age > 199) continue
    const index = AGE_BANDS.findIndex((band) => {
      const [min, max] = band.split("-").map(Number)
      return age >= min && age <= max
    })
    if (index >= 0) counts[index] += 1
  }
  return counts
}

/** Soma do preço mensal das vidas informadas. Null se a tabela não tem preço para alguma faixa usada. */
export function priceFor(table: Pick<CatalogTable, "precos">, lives: LivesByBand): number | null {
  let total = 0
  for (let i = 0; i < AGE_BANDS.length; i++) {
    const count = lives[i] ?? 0
    if (count === 0) continue
    const price = table.precos[AGE_BANDS[i]]
    if (price == null) return null
    total += price * count
  }
  return Math.round(total * 100) / 100
}

/** Elegibilidade pela faixa de vidas da tabela (mínimo e máximo por operadora). */
export function isEligibleByLives(table: Pick<CatalogTable, "vidasMin" | "vidasMax">, totalVidas: number): boolean {
  if (table.vidasMin > 0 && totalVidas < table.vidasMin) return false
  if (table.vidasMax > 0 && totalVidas > table.vidasMax) return false
  return true
}

/** Filtros de atributos (acomodação, coparticipação, contratação, MEI) e de rede. */
export function passesFilters<T extends CatalogTable>(
  table: T,
  filters: SimulationFilters,
  hospitalsByPlano: ReadonlyMap<number, ReadonlySet<number>>,
): boolean {
  if (filters.acomodacoes.length && !filters.acomodacoes.includes(table.acomodacao)) return false
  if (filters.coparticipacoes.length && !filters.coparticipacoes.includes(table.coparticipacao)) return false
  if (filters.contratacoes.length && !filters.contratacoes.includes(table.contratacao)) return false
  if (filters.mei && !table.aceitaMei) return false
  if (filters.hospitalIds.length) {
    const network = hospitalsByPlano.get(table.planoId)
    if (!network) return false
    for (const hospitalId of filters.hospitalIds) {
      if (!network.has(hospitalId)) return false
    }
  }
  return true
}

/**
 * Pipeline completo: estado -> atributos -> vidas -> preço -> faixa de valor.
 * Mesma ordem do protótipo, para que os números batam com o que foi validado.
 */
export function simulate<T extends CatalogTable>(
  tables: readonly T[],
  input: { uf: string; lives: LivesByBand; filters: SimulationFilters },
  hospitalsByPlano: ReadonlyMap<number, ReadonlySet<number>>,
): SimulationResult<T> {
  const totalVidas = input.lives.reduce((sum, n) => sum + n, 0)
  const empty: SimulationResult<T> = { rows: [], totalVidas, ocultosPorVidas: 0, ocultosPorValor: 0 }
  if (totalVidas === 0) return empty

  const rows: SimulationRow<T>[] = []
  let ocultosPorVidas = 0
  let ocultosPorValor = 0

  for (const table of tables) {
    if (table.estado !== input.uf) continue
    if (!passesFilters(table, input.filters, hospitalsByPlano)) continue

    if (input.filters.respeitarMinimoVidas && !isEligibleByLives(table, totalVidas)) {
      ocultosPorVidas += 1
      continue
    }

    const total = priceFor(table, input.lives)
    if (total == null) continue

    const { valorMin, valorMax } = input.filters
    if ((valorMin != null && total < valorMin) || (valorMax != null && total > valorMax)) {
      ocultosPorValor += 1
      continue
    }

    rows.push({ table, total })
  }

  rows.sort((a, b) => a.total - b.total)
  return { rows, totalVidas, ocultosPorVidas, ocultosPorValor }
}
