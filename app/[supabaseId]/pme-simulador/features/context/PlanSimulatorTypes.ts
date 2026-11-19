import type { SimulationFilters } from "@/lib/planSimulator/planSimulator";
import type { SheetPlan } from "@/components/plan-simulator/PlanSheet";

export type QuoteState = {
  lives: number[];
  uf: string;
  filters: SimulationFilters;
  sel: string[];
};

export type QuoteSummary = { min: number | null; nops: number; vidas: number };

export type QuoteListItem = {
  id: string;
  nome: string;
  uf: string | null;
  vidas: number;
  selecionados: number;
  resumo: QuoteSummary | null;
  updatedAt: string;
};

export type QuoteDetail = {
  id: string;
  nome: string;
  state: QuoteState | null;
  resumo: QuoteSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type SimulationRow = {
  chave: string;
  operadora: string;
  logoPath: string;
  produto: string;
  precos: Record<string, number>;
  plano: string;
  tabela: string;
  acomodacao: string;
  contratacao: string;
  coparticipacao: string;
  coparticipacaoTabela: string;
  aceitaMei: boolean;
  vidasMin: number;
  vidasMax: number;
  total: number;
};

export type FacetCounts = {
  acomodacoes: Record<string, number>;
  coparticipacoes: Record<string, number>;
  contratacoes: Record<string, number>;
};

export type SimulationResponse = {
  rows: SimulationRow[];
  totalVidas: number;
  ocultosPorVidas: number;
  ocultosPorValor: number;
  facets: FacetCounts;
};

/** Detalhe do plano: mesmo formato da folha de detalhes. */
export type PlanDetail = SheetPlan;

export type ProviderHit = { id: number; nome: string; cidade: string | null; uf: string | null; bairro: string | null };

export type PlanSimulatorView = "home" | "wizard" | "results";

export const UF_OPTIONS = [
  { uf: "SP", nome: "São Paulo", capital: "São Paulo" },
  { uf: "RJ", nome: "Rio de Janeiro", capital: "Rio de Janeiro" },
  { uf: "BA", nome: "Bahia", capital: "Salvador" },
  { uf: "MG", nome: "Minas Gerais", capital: "Belo Horizonte" },
  { uf: "DF", nome: "Distrito Federal", capital: "Brasília" },
] as const;

export const AGE_BAND_LABELS = ["00 a 18", "19 a 23", "24 a 28", "29 a 33", "34 a 38", "39 a 43", "44 a 48", "49 a 53", "54 a 58", "59 ou mais"] as const;

export const QUOTE_MAX_SELECTED = 40;
