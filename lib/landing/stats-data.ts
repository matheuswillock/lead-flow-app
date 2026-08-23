export type LandingStatFormat = "number" | "compact"

export type LandingStat = {
  label: string
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  format?: LandingStatFormat
}

export type LandingStatsSnapshot = {
  activeCorretores: number
  totalLeads: number
}

/**
 * Zero não é número de vitrine: "+0 corretores ativos" é pior que não exibir
 * a faixa. Quem chama esconde a seção quando isto retorna false.
 */
export function hasPublishableStats(snapshot: LandingStatsSnapshot | null): snapshot is LandingStatsSnapshot {
  return snapshot !== null && snapshot.activeCorretores > 0 && snapshot.totalLeads > 0
}

/**
 * Só entram aqui números com fonte verificável no banco.
 * Ver agents.md › Landing Page Method › Inventário de fatos: número sem fonte
 * MUST NOT ir para a UI.
 */
export function buildStatsData(snapshot: LandingStatsSnapshot): LandingStat[] {
  return [
    {
      label: "Corretores ativos",
      value: snapshot.activeCorretores,
      prefix: "+",
    },
    {
      label: "Leads gerenciados",
      value: snapshot.totalLeads,
      format: "compact",
    },
  ]
}
