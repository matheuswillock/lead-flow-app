import type { IAssociadosService } from "./IAssociadosService";
import type { AssociadosData, AssociadosFiltersState } from "../context/AssociadosTypes";

async function parseOutput<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json();
  if (!json.isValid) {
    throw new Error(json.errorMessages?.[0] ?? fallback);
  }
  return json.result as T;
}

export class AssociadosService implements IAssociadosService {
  async listProposals(
    supabaseId: string,
    teamId: string,
    filters: AssociadosFiltersState
  ): Promise<AssociadosData> {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.associateAccountId) params.set("associateAccountId", filters.associateAccountId);
    if (filters.teamId) params.set("teamId", filters.teamId);
    if (filters.closerId) params.set("closerId", filters.closerId);
    params.set("page", String(filters.page));
    params.set("pageSize", String(filters.pageSize));

    const res = await fetch(`/api/v1/associates/proposals?${params.toString()}`, {
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": teamId,
      },
    });

    return parseOutput<AssociadosData>(res, "Erro ao listar propostas");
  }

  async criticize(
    supabaseId: string,
    teamId: string,
    leadId: string,
    input: { title: string; message: string }
  ): Promise<void> {
    const res = await fetch(`/api/v1/associates/proposals/${leadId}/criticize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": supabaseId,
        "x-team-id": teamId,
      },
      body: JSON.stringify(input),
    });
    await parseOutput(res, "Erro ao criticar proposta");
  }

  async registerSale(
    supabaseId: string,
    teamId: string,
    leadId: string,
    input: { operatorName: string; proposalNumber?: string; notes?: string }
  ): Promise<void> {
    const res = await fetch(`/api/v1/associates/proposals/${leadId}/register-sale`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": supabaseId,
        "x-team-id": teamId,
      },
      body: JSON.stringify(input),
    });
    await parseOutput(res, "Erro ao registrar venda");
  }
}

export const associadosService = new AssociadosService();
