import type { Output } from "@/lib/output";
import { API_CLIENT_BASE } from "@/lib/route-map";
import type { PlanDetail, ProviderHit, QuoteDetail, QuoteListItem, QuoteState, SimulationResponse } from "../context/PlanSimulatorTypes";
import type { IPlanSimulatorService, PlanSimulatorHeaders } from "./IPlanSimulatorService";

const BASE = `${API_CLIENT_BASE}/plan-simulator`;

async function call<T>(h: PlanSimulatorHeaders, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      "x-supabase-user-id": h.supabaseId,
      "x-team-id": h.teamId,
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const output = (await response.json().catch(() => null)) as Output | null;
  if (!response.ok || !output?.isValid) {
    throw new Error(output?.errorMessages?.[0] ?? "Não foi possível concluir a ação.");
  }
  return output.result as T;
}

class PlanSimulatorService implements IPlanSimulatorService {
  listQuotes(h: PlanSimulatorHeaders) {
    return call<QuoteListItem[]>(h, "/quotes");
  }
  getQuote(h: PlanSimulatorHeaders, id: string) {
    return call<QuoteDetail>(h, `/quotes/${id}`);
  }
  createQuote(h: PlanSimulatorHeaders, nome: string, state: QuoteState) {
    return call<QuoteDetail>(h, "/quotes", { method: "POST", body: { nome, state } });
  }
  updateQuote(h: PlanSimulatorHeaders, id: string, data: { nome?: string; state?: QuoteState }) {
    return call<QuoteDetail>(h, `/quotes/${id}`, { method: "PATCH", body: data });
  }
  duplicateQuote(h: PlanSimulatorHeaders, id: string) {
    return call<QuoteDetail>(h, `/quotes/${id}/duplicate`, { method: "POST" });
  }
  async deleteQuote(h: PlanSimulatorHeaders, id: string) {
    await call<{ id: string }>(h, `/quotes/${id}`, { method: "DELETE" });
  }
  shareQuote(h: PlanSimulatorHeaders, id: string) {
    return call<{ token: string }>(h, `/quotes/${id}/share`, { method: "POST" });
  }
  simulate(h: PlanSimulatorHeaders, input: { uf: string; lives: number[]; filters: QuoteState["filters"] }) {
    return call<SimulationResponse>(h, "/simulate", { method: "POST", body: input });
  }
  tableDetail(h: PlanSimulatorHeaders, chave: string) {
    return call<PlanDetail>(h, `/tables/${encodeURIComponent(chave)}`);
  }
  searchProviders(h: PlanSimulatorHeaders, q: string, uf: string | null) {
    const params = new URLSearchParams({ q });
    if (uf) params.set("uf", uf);
    return call<ProviderHit[]>(h, `/providers?${params.toString()}`);
  }
}

export const planSimulatorService = new PlanSimulatorService();
