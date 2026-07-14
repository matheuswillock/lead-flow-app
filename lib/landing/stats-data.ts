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

export const landingStatsFallback: LandingStatsSnapshot = {
  activeCorretores: 280,
  totalLeads: 1_200_000,
}

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
