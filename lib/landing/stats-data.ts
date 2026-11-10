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
 * Cada número precisa de fonte registrada em `docs/design/landing-fatos-stats.md`
 * (agents.md › Landing Page Method › Inventário de fatos). Corretores e leads vêm
 * do banco; fechamentos e satisfação foram informados pelo dono do produto, com
 * origem em pesquisas e reuniões com corretores.
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
    {
      label: "Mais fechamentos",
      value: 31,
      suffix: "%",
    },
    {
      label: "Satisfação",
      value: 4.9,
      suffix: "/5",
      decimals: 1,
    },
  ]
}
