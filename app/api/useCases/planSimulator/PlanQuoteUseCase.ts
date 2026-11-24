import type { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { buildShareSnapshot, newShareToken, quoteStateSchema, summarizeQuote, QUOTE_LIMITS, type QuoteState } from "@/lib/planSimulator/quote"
import { PrismaPlanQuoteRepository, type PlanQuoteScope } from "@/app/api/infra/data/repositories/planCatalog/PrismaPlanQuoteRepository"
import { PrismaPlanCatalogReadRepository } from "@/app/api/infra/data/repositories/planCatalog/PrismaPlanCatalogReadRepository"
import { PlanSimulatorUseCase } from "./PlanSimulatorUseCase"

export const PLAN_QUOTE_MESSAGES = {
  INVALID_INPUT: "Dados da cotação inválidos.",
  NOT_FOUND: "Cotação não encontrada.",
  NAME_REQUIRED: "Dê um nome à cotação.",
  NO_PLANS: "Escolha ao menos um plano para enviar ao cliente.",
  NO_LIVES: "Informe ao menos uma vida para enviar a cotação ao cliente.",
  LINK_NOT_FOUND: "Este link não existe ou foi removido.",
  LINK_EXPIRED: "Este link expirou.",
  INTERNAL: "Erro ao processar a cotação.",
} as const

type QuoteRow = {
  id: string
  nome: string
  state: Prisma.JsonValue
  resumo: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}

type QuoteRepo = Pick<PrismaPlanQuoteRepository, "list" | "findOwned" | "create" | "update" | "delete" | "createShare" | "findShareByToken">

export class PlanQuoteUseCase {
  constructor(
    private readonly quotes: QuoteRepo = new PrismaPlanQuoteRepository(),
    private readonly catalog = new PrismaPlanCatalogReadRepository(),
    private readonly simulator = new PlanSimulatorUseCase(),
  ) {}

  async list(scope: PlanQuoteScope): Promise<Output> {
    try {
      const rows = await this.quotes.list(scope)
      return new Output(true, [], [], rows.map(toListItem))
    } catch (error) {
      console.error("[PlanQuoteUseCase][list]", error)
      return new Output(false, [], [PLAN_QUOTE_MESSAGES.INTERNAL], null)
    }
  }

  async get(id: string, scope: PlanQuoteScope): Promise<Output> {
    try {
      const row = await this.quotes.findOwned(id, scope)
      if (!row) return new Output(false, [], [PLAN_QUOTE_MESSAGES.NOT_FOUND], null)
      return new Output(true, [], [], toDetail(row))
    } catch (error) {
      console.error("[PlanQuoteUseCase][get]", error)
      return new Output(false, [], [PLAN_QUOTE_MESSAGES.INTERNAL], null)
    }
  }

  async create(scope: PlanQuoteScope, input: { nome: string; state: unknown }): Promise<Output> {
    try {
      const nome = input.nome.trim().slice(0, QUOTE_LIMITS.maxNome)
      if (!nome) return new Output(false, [], [PLAN_QUOTE_MESSAGES.NAME_REQUIRED], null)
      const state = parseState(input.state)
      if (!state) return new Output(false, [], [PLAN_QUOTE_MESSAGES.INVALID_INPUT], null)

      const resumo = await this.resumoFor(state)
      const row = await this.quotes.create(scope, {
        nome,
        state: state as unknown as Prisma.InputJsonValue,
        resumo: resumo as unknown as Prisma.InputJsonValue,
      })
      return new Output(true, [], [], toDetail(row))
    } catch (error) {
      console.error("[PlanQuoteUseCase][create]", error)
      return new Output(false, [], [PLAN_QUOTE_MESSAGES.INTERNAL], null)
    }
  }

  async update(id: string, scope: PlanQuoteScope, input: { nome?: string; state?: unknown }): Promise<Output> {
    try {
      const existing = await this.quotes.findOwned(id, scope)
      if (!existing) return new Output(false, [], [PLAN_QUOTE_MESSAGES.NOT_FOUND], null)

      const data: { nome?: string; state?: Prisma.InputJsonValue; resumo?: Prisma.InputJsonValue } = {}
      if (input.nome !== undefined) {
        const nome = input.nome.trim().slice(0, QUOTE_LIMITS.maxNome)
        if (!nome) return new Output(false, [], [PLAN_QUOTE_MESSAGES.NAME_REQUIRED], null)
        data.nome = nome
      }
      if (input.state !== undefined) {
        const state = parseState(input.state)
        if (!state) return new Output(false, [], [PLAN_QUOTE_MESSAGES.INVALID_INPUT], null)
        data.state = state as unknown as Prisma.InputJsonValue
        data.resumo = (await this.resumoFor(state)) as unknown as Prisma.InputJsonValue
      }

      const row = await this.quotes.update(id, data)
      return new Output(true, [], [], toDetail(row))
    } catch (error) {
      console.error("[PlanQuoteUseCase][update]", error)
      return new Output(false, [], [PLAN_QUOTE_MESSAGES.INTERNAL], null)
    }
  }

  async duplicate(id: string, scope: PlanQuoteScope): Promise<Output> {
    try {
      const existing = await this.quotes.findOwned(id, scope)
      if (!existing) return new Output(false, [], [PLAN_QUOTE_MESSAGES.NOT_FOUND], null)
      const copy = await this.quotes.create(scope, {
        nome: `${existing.nome} (cópia)`.slice(0, QUOTE_LIMITS.maxNome),
        state: existing.state as Prisma.InputJsonValue,
        resumo: (existing.resumo ?? undefined) as Prisma.InputJsonValue | undefined,
      })
      return new Output(true, [], [], toDetail(copy))
    } catch (error) {
      console.error("[PlanQuoteUseCase][duplicate]", error)
      return new Output(false, [], [PLAN_QUOTE_MESSAGES.INTERNAL], null)
    }
  }

  async delete(id: string, scope: PlanQuoteScope): Promise<Output> {
    try {
      const existing = await this.quotes.findOwned(id, scope)
      if (!existing) return new Output(false, [], [PLAN_QUOTE_MESSAGES.NOT_FOUND], null)
      await this.quotes.delete(id)
      return new Output(true, [], [], { id })
    } catch (error) {
      console.error("[PlanQuoteUseCase][delete]", error)
      return new Output(false, [], [PLAN_QUOTE_MESSAGES.INTERNAL], null)
    }
  }

  /** Cria um link do cliente com snapshot imutável dos planos escolhidos. */
  async share(id: string, scope: PlanQuoteScope, now = new Date()): Promise<Output> {
    try {
      const existing = await this.quotes.findOwned(id, scope)
      if (!existing) return new Output(false, [], [PLAN_QUOTE_MESSAGES.NOT_FOUND], null)
      const state = parseState(existing.state)
      if (!state) return new Output(false, [], [PLAN_QUOTE_MESSAGES.INVALID_INPUT], null)
      if (state.sel.length === 0) return new Output(false, [], [PLAN_QUOTE_MESSAGES.NO_PLANS], null)
      // Sem vidas os totais saem zerados: recusa antes de congelar um snapshot inválido.
      if (state.lives.every((n) => n === 0)) return new Output(false, [], [PLAN_QUOTE_MESSAGES.NO_LIVES], null)

      const plans = await this.simulator.snapshotPlans(state.sel, state.lives)
      if (plans.length === 0) return new Output(false, [], [PLAN_QUOTE_MESSAGES.NO_PLANS], null)

      const payload = buildShareSnapshot({
        nome: existing.nome,
        uf: state.uf,
        lives: state.lives,
        filters: state.filters,
        plans,
        now,
      })
      const token = newShareToken()
      await this.quotes.createShare(id, token, payload as unknown as Prisma.InputJsonValue)
      return new Output(true, [], [], { token })
    } catch (error) {
      console.error("[PlanQuoteUseCase][share]", error)
      return new Output(false, [], [PLAN_QUOTE_MESSAGES.INTERNAL], null)
    }
  }

  /** Leitura pública pelo token. Sem autenticação: o token é o segredo. */
  async publicShare(token: string, now = new Date()): Promise<Output> {
    try {
      const share = await this.quotes.findShareByToken(token)
      if (!share) return new Output(false, [], [PLAN_QUOTE_MESSAGES.LINK_NOT_FOUND], null)
      if (share.expiresAt && share.expiresAt.getTime() < now.getTime()) {
        return new Output(false, [], [PLAN_QUOTE_MESSAGES.LINK_EXPIRED], null)
      }
      return new Output(true, [], [], share.payload)
    } catch (error) {
      console.error("[PlanQuoteUseCase][publicShare]", error)
      return new Output(false, [], [PLAN_QUOTE_MESSAGES.INTERNAL], null)
    }
  }

  private async resumoFor(state: QuoteState) {
    const tables = await this.catalog.tablesByChaves(state.sel)
    return summarizeQuote(tables, state.lives)
  }
}

function parseState(value: unknown): QuoteState | null {
  const parsed = quoteStateSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function toListItem(row: QuoteRow) {
  const state = parseState(row.state)
  return {
    id: row.id,
    nome: row.nome,
    uf: state?.uf ?? null,
    vidas: state ? state.lives.reduce((a, b) => a + b, 0) : 0,
    selecionados: state?.sel.length ?? 0,
    resumo: row.resumo,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toDetail(row: QuoteRow) {
  return {
    id: row.id,
    nome: row.nome,
    state: parseState(row.state),
    resumo: row.resumo,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
