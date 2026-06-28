import type { AssociadosData, AssociadosFiltersState } from "../context/AssociadosTypes";

export interface IAssociadosService {
  listProposals(
    supabaseId: string,
    teamId: string,
    filters: AssociadosFiltersState
  ): Promise<AssociadosData>;

  criticize(
    supabaseId: string,
    teamId: string,
    leadId: string,
    input: { title: string; message: string }
  ): Promise<void>;

  registerSale(
    supabaseId: string,
    teamId: string,
    leadId: string,
    input: { operatorName: string; proposalNumber?: string; notes?: string }
  ): Promise<void>;
}
