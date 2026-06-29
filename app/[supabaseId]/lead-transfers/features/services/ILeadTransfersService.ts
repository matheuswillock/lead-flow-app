import type {
  LeadTransfersData,
  LeadTransfersFiltersState,
} from "../context/LeadTransfersTypes";

export interface ILeadTransfersService {
  list(
    supabaseId: string,
    teamId: string,
    filters: LeadTransfersFiltersState
  ): Promise<LeadTransfersData>;
}
