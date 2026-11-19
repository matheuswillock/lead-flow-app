import { prisma } from "@/app/api/infra/data/prisma"
import type { CatalogTable } from "@/lib/planSimulator/planSimulator"

export type CatalogTableRecord = CatalogTable & {
  coparticipacaoTabela: string
  cidade: string
  remissao: boolean
  regras: Record<string, string>
  operatorLogoPath: string
}

const tableSelect = {
  chave: true,
  estado: true,
  cidade: true,
  planoId: true,
  plano: true,
  tabela: true,
  acomodacao: true,
  contratacao: true,
  coparticipacao: true,
  coparticipacaoTabela: true,
  aceitaMei: true,
  remissao: true,
  vidasMin: true,
  vidasMax: true,
  precos: true,
  regras: true,
  operator: { select: { name: true, logoPath: true } },
} as const;

type TableRow = {
  chave: string;
  estado: string;
  cidade: string;
  planoId: number;
  plano: string;
  tabela: string;
  acomodacao: string;
  contratacao: string;
  coparticipacao: string;
  coparticipacaoTabela: string;
  aceitaMei: boolean;
  remissao: boolean;
  vidasMin: number;
  vidasMax: number;
  precos: unknown;
  regras: unknown;
  operator: { name: string; logoPath: string };
};

function toRecord(r: TableRow): CatalogTableRecord {
  return {
    chave: r.chave,
    estado: r.estado,
    cidade: r.cidade,
    operatorName: r.operator.name,
    operatorLogoPath: r.operator.logoPath,
    planoId: r.planoId,
    plano: r.plano,
    tabela: r.tabela,
    acomodacao: r.acomodacao,
    contratacao: r.contratacao,
    coparticipacao: r.coparticipacao,
    coparticipacaoTabela: r.coparticipacaoTabela,
    aceitaMei: r.aceitaMei,
    remissao: r.remissao,
    vidasMin: r.vidasMin,
    vidasMax: r.vidasMax,
    precos: r.precos as Record<string, number>,
    regras: r.regras as Record<string, string>,
  };
}

export class PrismaPlanCatalogReadRepository {
  async listTablesByState(uf: string): Promise<CatalogTableRecord[]> {
    const rows = await prisma.healthPlanTable.findMany({
      where: { estado: uf },
      select: tableSelect,
      orderBy: [{ operator: { name: "asc" } }, { plano: "asc" }],
    })
    return rows.map(toRecord)
  }

  /** Mapa planoId -> ids de hospitais, restrito a um estado. Usado só quando há filtro de rede. */
  async hospitalsByPlanoForState(uf: string): Promise<Map<number, Set<number>>> {
    const planoIds = await prisma.healthPlanTable.findMany({
      where: { estado: uf },
      select: { planoId: true },
      distinct: ["planoId"],
    })
    const entries = await prisma.healthPlanNetworkEntry.findMany({
      where: { kind: "HOSPITAL", planoId: { in: planoIds.map((p) => p.planoId) } },
      select: { planoId: true, providerId: true },
    })
    const map = new Map<number, Set<number>>()
    for (const e of entries) {
      if (!map.has(e.planoId)) map.set(e.planoId, new Set())
      map.get(e.planoId)!.add(e.providerId)
    }
    return map
  }

  /** Textos das regras referenciadas, por id. */
  async ruleTextsByIds(ids: string[]): Promise<Map<string, string>> {
    const rows = await prisma.healthPlanRuleText.findMany({ where: { id: { in: ids } } })
    return new Map(rows.map((r) => [r.id, r.texto]))
  }

  /** Rede de um plano, com dados do credenciado. */
  async networkForPlano(planoId: number) {
    return prisma.healthPlanNetworkEntry.findMany({
      where: { planoId },
      select: {
        kind: true,
        atendimento: true,
        provider: { select: { nome: true, cidade: true, uf: true } },
      },
      orderBy: [{ kind: "asc" }, { providerId: "asc" }],
    })
  }

  async searchProviders(query: string, uf: string | null, limit: number) {
    const term = query.trim()
    if (term.length < 2) return []
    return prisma.healthPlanProvider.findMany({
      where: {
        nome: { contains: term, mode: "insensitive" },
        ...(uf ? { uf } : {}),
      },
      select: { id: true, nome: true, cidade: true, uf: true, bairro: true },
      orderBy: { nome: "asc" },
      take: limit,
    })
  }

  async tablesByChaves(chaves: string[]): Promise<CatalogTableRecord[]> {
    if (chaves.length === 0) return []
    const rows = await prisma.healthPlanTable.findMany({
      where: { chave: { in: chaves } },
      select: tableSelect,
    })
    return rows.map(toRecord)
  }
}
