import { Output } from "@/lib/output"
import { facetCounts, priceFor, simulate, type Facets, type LivesByBand, type SimulationFilters } from "@/lib/planSimulator/planSimulator"
import type { SnapshotPlan } from "@/lib/planSimulator/quote"
import { PrismaPlanCatalogReadRepository, type CatalogTableRecord } from "@/app/api/infra/data/repositories/planCatalog/PrismaPlanCatalogReadRepository"

export const PLAN_SIMULATOR_MESSAGES = {
  INVALID_INPUT: "Dados do simulador inválidos.",
  NOT_FOUND: "Plano não encontrado.",
  INTERNAL: "Erro ao executar o simulador.",
} as const

/** Contrato mínimo de leitura do catálogo, injetado no caso de uso. */
export interface IPlanCatalogReader {
  listTablesByState(uf: string): Promise<CatalogTableRecord[]>
  hospitalsByPlanoForState(uf: string): Promise<Map<number, Set<number>>>
  tablesByChaves(chaves: string[]): Promise<CatalogTableRecord[]>
  ruleTextsByIds(ids: string[]): Promise<Map<string, string>>
  networkForPlano(planoId: number): Promise<NetworkRow[]>
  searchProviders(query: string, uf: string | null, limit: number): Promise<unknown[]>
}

export type NetworkRow = {
  kind: "HOSPITAL" | "LAB"
  providerId: number
  atendimento: string[]
  provider: { nome: string; bairro: string | null; cidade: string | null; uf: string | null }
}

export type SimulateInput = { uf: string; lives: LivesByBand; filters: SimulationFilters }

export class PlanSimulatorUseCase {
  constructor(private readonly catalog: IPlanCatalogReader = new PrismaPlanCatalogReadRepository()) {}

  async simulate(input: SimulateInput): Promise<Output> {
    try {
      const tables = await this.catalog.listTablesByState(input.uf)
      const hospitals = input.filters.hospitalIds.length
        ? await this.catalog.hospitalsByPlanoForState(input.uf)
        : new Map<number, Set<number>>()

      const result = simulate(tables, { uf: input.uf, lives: input.lives, filters: input.filters }, hospitals)
      // Contagens dos chips usam o estado inteiro, sem a regra de vidas (como no protótipo).
      const facets: Facets = facetCounts(tables, input.uf, input.filters, hospitals)
      const rows = result.rows.map(({ table, total }) => {
        const record = table
        return {
          chave: record.chave,
          operadora: record.operatorName,
          logoPath: record.operatorLogoPath,
          produto: record.produto,
          precos: record.precos,
          regrasTipos: Object.keys(record.regras),
          plano: record.plano,
          tabela: record.tabela,
          acomodacao: record.acomodacao,
          contratacao: record.contratacao,
          coparticipacao: record.coparticipacao,
          coparticipacaoTabela: record.coparticipacaoTabela,
          aceitaMei: record.aceitaMei,
          vidasMin: record.vidasMin,
          vidasMax: record.vidasMax,
          total,
        }
      })

      return new Output(true, [], [], {
        rows,
        totalVidas: result.totalVidas,
        ocultosPorVidas: result.ocultosPorVidas,
        ocultosPorValor: result.ocultosPorValor,
        facets,
      })
    } catch (error) {
      console.error("[PlanSimulatorUseCase][simulate]", error)
      return new Output(false, [], [PLAN_SIMULATOR_MESSAGES.INTERNAL], null)
    }
  }

  /** Detalhe de um plano: regras em texto e rede credenciada, resolvidos. */
  async tableDetail(chave: string): Promise<Output> {
    try {
      const [table] = await this.catalog.tablesByChaves([chave])
      if (!table) return new Output(false, [], [PLAN_SIMULATOR_MESSAGES.NOT_FOUND], null)
      return new Output(true, [], [], await this.buildDetail(table))
    } catch (error) {
      console.error("[PlanSimulatorUseCase][tableDetail]", error)
      return new Output(false, [], [PLAN_SIMULATOR_MESSAGES.INTERNAL], null)
    }
  }

  async searchProviders(query: string, uf: string | null): Promise<Output> {
    try {
      return new Output(true, [], [], await this.catalog.searchProviders(query, uf, 20))
    } catch (error) {
      console.error("[PlanSimulatorUseCase][searchProviders]", error)
      return new Output(false, [], [PLAN_SIMULATOR_MESSAGES.INTERNAL], null)
    }
  }

  /** Monta o snapshot dos planos escolhidos, com total calculado para as vidas atuais. */
  async snapshotPlans(chaves: string[], lives: LivesByBand): Promise<SnapshotPlan[]> {
    const tables = await this.catalog.tablesByChaves(chaves)
    const plans: SnapshotPlan[] = []
    for (const table of tables) {
      const total = priceFor(table, lives)
      if (total == null) continue
      const detail = await this.buildDetail(table)
      plans.push({ ...detail, total })
    }
    return plans
  }

  private async buildDetail(table: CatalogTableRecord) {
    const regras = Object.entries(table.regras)
    const texts = await this.catalog.ruleTextsByIds(regras.map(([, id]) => id))
    const network = await this.catalog.networkForPlano(table.planoId)
    return {
      chave: table.chave,
      operadora: table.operatorName,
      logoPath: table.operatorLogoPath,
      produto: table.produto,
      plano: table.plano,
      tabela: table.tabela,
      acomodacao: table.acomodacao,
      contratacao: table.contratacao,
      coparticipacao: table.coparticipacao,
      coparticipacaoTabela: table.coparticipacaoTabela,
      aceitaMei: table.aceitaMei,
      vidasMin: table.vidasMin,
      vidasMax: table.vidasMax,
      precos: table.precos,
      regras: regras.map(([tipo, id]) => ({ tipo, texto: texts.get(id) ?? "" })),
      rede: {
        hospitais: network
          .filter((n) => n.kind === "HOSPITAL")
          .map((n) => ({ id: n.providerId, nome: n.provider.nome, bairro: n.provider.bairro, cidade: n.provider.cidade, uf: n.provider.uf, siglas: n.atendimento })),
        laboratorios: network
          .filter((n) => n.kind === "LAB")
          .map((n) => ({ id: n.providerId, nome: n.provider.nome, bairro: n.provider.bairro, cidade: n.provider.cidade, uf: n.provider.uf })),
      },
    }
  }
}
