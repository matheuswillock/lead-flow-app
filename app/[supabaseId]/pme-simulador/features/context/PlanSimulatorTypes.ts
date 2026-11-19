import type { SimulationFilters } from "@/lib/planSimulator/planSimulator";

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

export type SimulationResponse = {
  rows: SimulationRow[];
  totalVidas: number;
  ocultosPorVidas: number;
  ocultosPorValor: number;
};

export type PlanDetail = {
  chave: string;
  operadora: string;
  logoPath: string;
  plano: string;
  tabela: string;
  acomodacao: string;
  contratacao: string;
  coparticipacao: string;
  regras: { tipo: string; texto: string }[];
  rede: {
    hospitais: { nome: string; cidade: string | null; uf: string | null; siglas: string[] }[];
    laboratorios: { nome: string; cidade: string | null; uf: string | null }[];
  };
};

export type ProviderHit = { id: number; nome: string; cidade: string | null; uf: string | null; bairro: string | null };

export type PlanSimulatorView = "home" | "wizard" | "results";

export const UF_OPTIONS = [
  { uf: "SP", nome: "São Paulo" },
  { uf: "RJ", nome: "Rio de Janeiro" },
  { uf: "BA", nome: "Salvador" },
  { uf: "MG", nome: "Belo Horizonte" },
  { uf: "DF", nome: "Brasília" },
] as const;

export const AGE_BAND_LABELS = ["00 a 18", "19 a 23", "24 a 28", "29 a 33", "34 a 38", "39 a 43", "44 a 48", "49 a 53", "54 a 58", "59 ou mais"] as const;

export const QUOTE_MAX_SELECTED = 40;
