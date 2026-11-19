import { randomBytes } from "node:crypto"
import { z } from "zod"
import { AGE_BANDS, priceFor, type CatalogTable, type LivesByBand, type SimulationFilters } from "./planSimulator"

export const QUOTE_LIMITS = { maxSelected: 40, maxNome: 80 } as const

const filtersSchema = z.object({
  acomodacoes: z.array(z.string().max(60)).max(10),
  coparticipacoes: z.array(z.string().max(60)).max(10),
  contratacoes: z.array(z.string().max(60)).max(10),
  hospitalIds: z.array(z.number().int().nonnegative()).max(30),
  mei: z.boolean(),
  respeitarMinimoVidas: z.boolean(),
  valorMin: z.number().nonnegative().nullable(),
  valorMax: z.number().nonnegative().nullable(),
})

/** Estado salvo da cotação (o que o corretor configurou). */
export const quoteStateSchema = z.object({
  lives: z.array(z.number().int().min(0).max(999)).length(AGE_BANDS.length),
  uf: z.string().length(2),
  filters: filtersSchema,
  sel: z.array(z.string().min(1).max(64)).max(QUOTE_LIMITS.maxSelected),
})

export type QuoteState = z.infer<typeof quoteStateSchema>

export type QuoteSummary = { min: number | null; nops: number; vidas: number }

/** Resumo mostrado na lista de cotações: menor valor entre os planos incluídos. */
export function summarizeQuote(tables: Pick<CatalogTable, "chave" | "precos">[], lives: LivesByBand): QuoteSummary {
  const totals = tables
    .map((t) => priceFor(t, lives))
    .filter((v): v is number => v != null)
  return {
    min: totals.length ? Math.min(...totals) : null,
    nops: totals.length,
    vidas: lives.reduce((a, b) => a + b, 0),
  }
}

/** Token público do link do cliente: 24 bytes aleatórios, base64url (32 caracteres). */
export function newShareToken(): string {
  return randomBytes(24).toString("base64url")
}

/** Detalhe de um plano incluído, congelado no momento do envio. */
export type SnapshotPlan = {
  chave: string
  operadora: string
  logoPath: string
  produto: string
  precos: Record<string, number>
  plano: string
  tabela: string
  acomodacao: string
  contratacao: string
  coparticipacao: string
  coparticipacaoTabela: string
  aceitaMei: boolean
  vidasMin: number
  vidasMax: number
  total: number
  regras: { tipo: string; texto: string }[]
  rede: { hospitais: { id: number; nome: string; bairro: string | null; cidade: string | null; uf: string | null; siglas: string[] }[]; laboratorios: { id: number; nome: string; bairro: string | null; cidade: string | null; uf: string | null }[] }
}

export type ShareSnapshot = {
  v: 1
  nome: string
  geradoEm: string
  uf: string
  lives: LivesByBand
  filters: SimulationFilters
  plans: SnapshotPlan[]
}

/** Snapshot imutável: o link mostra exatamente o que foi enviado, mesmo que o catálogo mude depois. */
export function buildShareSnapshot(input: {
  nome: string
  uf: string
  lives: LivesByBand
  filters: SimulationFilters
  plans: SnapshotPlan[]
  now: Date
}): ShareSnapshot {
  return {
    v: 1,
    nome: input.nome.slice(0, QUOTE_LIMITS.maxNome),
    geradoEm: input.now.toISOString(),
    uf: input.uf,
    lives: input.lives,
    filters: input.filters,
    plans: [...input.plans].sort((a, b) => a.total - b.total),
  }
}
