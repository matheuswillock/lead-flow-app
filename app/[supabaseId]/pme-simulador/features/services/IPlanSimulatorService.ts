import type { QuoteDetail, QuoteListItem, PlanDetail, ProviderHit, QuoteState, SimulationResponse } from "../context/PlanSimulatorTypes";
import type { SimulationFilters } from "@/lib/planSimulator/planSimulator";

export type PlanSimulatorHeaders = { supabaseId: string; teamId: string };

export interface IPlanSimulatorService {
  listQuotes(h: PlanSimulatorHeaders): Promise<QuoteListItem[]>;
  getQuote(h: PlanSimulatorHeaders, id: string): Promise<QuoteDetail>;
  createQuote(h: PlanSimulatorHeaders, nome: string, state: QuoteState): Promise<QuoteDetail>;
  updateQuote(h: PlanSimulatorHeaders, id: string, data: { nome?: string; state?: QuoteState }): Promise<QuoteDetail>;
  duplicateQuote(h: PlanSimulatorHeaders, id: string): Promise<QuoteDetail>;
  deleteQuote(h: PlanSimulatorHeaders, id: string): Promise<void>;
  shareQuote(h: PlanSimulatorHeaders, id: string): Promise<{ token: string }>;
  simulate(h: PlanSimulatorHeaders, input: { uf: string; lives: number[]; filters: SimulationFilters }): Promise<SimulationResponse>;
  tableDetail(h: PlanSimulatorHeaders, chave: string): Promise<PlanDetail>;
  searchProviders(h: PlanSimulatorHeaders, q: string, uf: string | null): Promise<ProviderHit[]>;
}
