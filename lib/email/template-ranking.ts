import { buildRates, safeRate } from "@/lib/email/analytics-rates"

/** Volume mínimo de envios para entrar no ranking (evita taxa 100% com 1 e-mail). */
export const TEMPLATE_RANKING_MIN_SENT = 1

export type TemplateGroupTotalsInput = {
  versionGroupId: string
  /** ID representativo (ex.: versão mais recente usada em disparo). */
  templateId: string
  name: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
}

export type RankedTemplate = TemplateGroupTotalsInput & {
  rates: ReturnType<typeof buildRates>
  rank: number
}

export type TemplateRankingResult = {
  byOpenRate: RankedTemplate[]
  byClickRate: RankedTemplate[]
}

function hasEnoughData(row: TemplateGroupTotalsInput): boolean {
  return row.sent >= TEMPLATE_RANKING_MIN_SENT
}

function compareByRate(
  a: TemplateGroupTotalsInput,
  b: TemplateGroupTotalsInput,
  rateOf: (row: TemplateGroupTotalsInput) => number,
  absoluteOf: (row: TemplateGroupTotalsInput) => number,
): number {
  const rateDiff = rateOf(b) - rateOf(a)
  if (rateDiff !== 0) return rateDiff
  const absDiff = absoluteOf(b) - absoluteOf(a)
  if (absDiff !== 0) return absDiff
  return a.name.localeCompare(b.name, "pt-BR")
}

function takeTop(
  rows: TemplateGroupTotalsInput[],
  rateOf: (row: TemplateGroupTotalsInput) => number,
  absoluteOf: (row: TemplateGroupTotalsInput) => number,
  limit = 3,
): RankedTemplate[] {
  return [...rows]
    .sort((a, b) => compareByRate(a, b, rateOf, absoluteOf))
    .slice(0, limit)
    .map((row, index) => ({
      ...row,
      rates: buildRates(row),
      rank: index + 1,
    }))
}

/**
 * Rankeia os melhores grupos de template (versionGroupId) por abertura e clique.
 * Empate: maior volume absoluto (opened/clicked), depois nome.
 * Sem dados suficientes (sent < MIN): excluído do ranking.
 */
export function rankTopTemplates(
  rows: TemplateGroupTotalsInput[],
  limit = 3,
): TemplateRankingResult {
  const eligible = rows.filter(hasEnoughData)

  return {
    byOpenRate: takeTop(
      eligible,
      (row) => safeRate(row.opened, row.sent),
      (row) => row.opened,
      limit,
    ),
    byClickRate: takeTop(
      eligible,
      (row) => safeRate(row.clicked, row.sent),
      (row) => row.clicked,
      limit,
    ),
  }
}

/**
 * Agrega disparos/campanhas brutos por versionGroupId antes do ranking.
 */
export function aggregateTemplateGroups(
  rows: Array<{
    versionGroupId: string
    templateId: string
    name: string
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
  }>,
): TemplateGroupTotalsInput[] {
  const map = new Map<string, TemplateGroupTotalsInput>()

  for (const row of rows) {
    const existing = map.get(row.versionGroupId)
    if (!existing) {
      map.set(row.versionGroupId, { ...row })
      continue
    }
    existing.sent += row.sent
    existing.delivered += row.delivered
    existing.opened += row.opened
    existing.clicked += row.clicked
    existing.bounced += row.bounced
    existing.complained += row.complained
    // Mantém nome/templateId da última ocorrência (ordem do caller).
    existing.name = row.name
    existing.templateId = row.templateId
  }

  return Array.from(map.values())
}
